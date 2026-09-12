const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const { send } = require('process');



const token = '8661483092:AAEODdmrRjZfN4KfIDuzO0QbWiYqjRMVMLk'; 
const bot = new TelegramBot(token, { polling: true });


const CHAT_LOG_DIR = path.join(__dirname, 'chat_logs');
const USER_LOG_DIR = path.join(__dirname, 'user_logs');
const CANCEL_FILE = '/root/atri/punishmentsToCancel.json';
const processedCancellations = new Set();
const MESSAGE_STATS_DIR = '/root/atri/message_stats';
const MESSAGE_STATS_FILE = path.join(MESSAGE_STATS_DIR, 'messages.json');

if (!fs.existsSync(MESSAGE_STATS_DIR)) fs.mkdirSync(MESSAGE_STATS_DIR);

if (!fs.existsSync(CHAT_LOG_DIR)) fs.mkdirSync(CHAT_LOG_DIR);
if (!fs.existsSync(USER_LOG_DIR)) fs.mkdirSync(USER_LOG_DIR);
const SUPPORT_DATA_DIR = path.join(__dirname, 'support_data');

if (!fs.existsSync(SUPPORT_DATA_DIR)) fs.mkdirSync(SUPPORT_DATA_DIR);

const TICKETS_FILE = path.join(SUPPORT_DATA_DIR, 'tickets.json');
const RATINGS_FILE = path.join(SUPPORT_DATA_DIR, 'ratings.json');
const temporaryRestrictions = {};
const reportStates = {};
const settingsInputStates = {};
const settingsState = {};
const captchaStates = {};
const autoMessageState = {};
//настройки

const SETTINGS_NAMES = {
    modchatID: {
        name: 'Чат модерации',
        description: 'ID чата, куда будут отправляться репорты и другая модераторская информация'
    },
    commandCd: {
        name: 'Задержка команд',
        description: 'Минимальное время (в секундах) между использованием команд обычными пользователями, на команды для админов не влияет'
    },
    warnExpireTime: {
        name: 'Срок автоматического снятия предупреждений',
        description: 'Время, через которое предупреждения автоматически снимаются (m - минуты, h - часы, d - дни, M - месяцы)'
    },
    warnPunishmentCount: {
        name: 'Лимит предупреждений',
        description: 'Количество предупреждений, после которого применяется наказание'
    },
    'warnPunishment.type': {
        name: 'Тип наказания за варны',
        description: 'Что происходит при достижении лимита предупреждений: mute (запрет на отправку сообщений) или ban (блокировка)'
    },
    'warnPunishment.duration': {
        name: 'Длительность наказания за варны',
        description: 'На сколько блокировать/мутить пользователя при достижении лимита (null - навсегда, или время в формате m - минуты, h - часы, d - дни, M - месяцы)'
    },
    quickMuteDuration: {
        name: 'Длительность быстрого мута',
        description: 'Длительность мута через кнопку в репорте (m - минуты, h - часы, d - дни, M - месяцы)'
    },
    autoComment: {
        name: 'Авто-комментарий',
        description: 'Включить автоматический комментарий при посте сообщений из канала, если чат не является комментариями каналла, то выключите эту настройку.'
    },
    autoCommentText: {
        name: 'Текст авто-комментария',
        description: 'Текст, который будет отправлен при пересылке сообщений из канала'
    },
    autoCommentTextEnd: {
        name: 'Концовка авто-комментария',
        description: 'Текст, который добавляется в конец авто-комментария'
    },
    allowKickme: {
        name: 'Разрешить /kickme',
        description: 'Разрешить пользователям выгонять себя из чата командой /kickme'
    },
    mediaRestrictionEnabled: {
        name: 'Ограничение медиа',
        description: 'Включить временное ограничение на отправку медиа-файлов после авто-комментария'
    },
    mediaRestrictionDuration: {
        name: 'Длительность ограничения медиа',
        description: 'На сколько запрещать отправку медиа-файлов после авто-комментария (m - минуты, h - часы, d - дни, M - месяцы)'
    },
    autoRaidMode: {
        name: 'Автоматический антирейд',
        description: 'Включить автоматическое обнаружение рейдов при массовых вступлениях.\n\n Режим рейда - это мой защитный механизм, который активируется при обнаружении массового вступления людей в чат.\n\n При включённой защите, я буду автоматически выгонять из группы всех вступивших в неё людей и запрещу простым пользователям писать в чат. Важно отметить, что я не блокирую администраторов, и не удаляю участников навсегда — я баню их и сразу разбаниваю обратно, для избежния случайного бана невиновных, и они спокойно смогли вернуться позже.\n\nПри выключенной настройке autoRaidMode автоматическое обнаружение не работает, но команды /RaidMode и /unRaidMode остаются доступны для ручного управления. Рекомендуется держать автоматический режим включённым для постоянной защиты, а уровень чувствительности выбирать в зависимости от активности вашего чата: чем активнее чат, тем выше должен быть уровень, чтобы избежать ложных срабатываний.'
    },
    raidSensitivity: {
        name: 'Чувствительность антирейда',
        description: 'Уровень активности чата (1-5). Определяет количество вступлений для активации рейда.\n\n Уровень 1 — минимальный, активирует защиту при 5 вступлениях за 15 секунд, подходит для очень тихих и малоактивных чатов, где даже небольшое количество новых людей за короткое время является аномалией.\n Уровень 2 — низкий, срабатывает при 7 вступлениях, для спокойных чатов с невысокой активностью.\n Уровень 3 — средний, 10 вступлений, значение по умолчанию, подходит для чатов со средней посещаемостью.\n Уровень 4 — высокий, 15 вступлений, для активных чатов, куда регулярно заходят новые участники.\n Уровень 5 — максимальный, 25 вступлений, для очень активных чатов с большим потоком новых пользователей, где только массовое нашествие из 25 человек за 15 секунд может считаться рейдом.'
    },
    autoDeleteEnabled: {
        name: 'Автоудаление сообщений бота',
        description: 'Включить автоматическое удаление сообщений бота и команд через заданное время'
    },
    autoDeleteDuration: {
        name: 'Время до автоудаления',
        description: 'Через сколько удалять сообщения бота и команды (m - минуты, h - часы, d - дни, M - месяцы)'
    },
    welcomeMessageEnabled: {
        name: 'Приветственное сообщение',
        description: 'Включить отправку приветственного сообщения новым участникам чата'
    },
    welcomeMessageText: {
        name: 'Текст приветственного сообщения',
        description: 'Текст, который будет отправлен новым участникам. Используйте ?name для упоминания пользователя. Например: "Добро пожаловать, ?name!"'
    },
    captchaEnabled: {
        name: 'Капча',
        description: 'Включить проверку капчи для новых участников. При включении автоматически включается приветственное сообщение'
    },
    captchaType: {
        name: 'Тип капчи',
        description: 'Тип капчи: "simple" (простая) — нужно нажать на кнопку, "hard" (сильная) — нужно решить математический пример'
    },
    captchaKickEnabled: {
        name: 'Автоисключение при непрохождении капчи',
        description: 'Если пользователь не проходит капчу за 5 минут, он будет исключён из чата (бан и сразу разбан)'
    },
        autoMessageEnabled: {
        name: 'Авто-сообщения',
        description: 'Включить автоматическую отправку сообщений в чат'
    },
    autoMessageInterval: {
        name: 'Период авто-сообщений',
        description: 'Как часто отправлять сообщения (m - минуты, h - часы, d - дни, M - месяцы). Например: 1h, 30m, 2d'
    },
    autoMessageText: {
        name: 'Текст авто-сообщений',
        description: 'Текст сообщений для автоматической отправки. Можно указать несколько сообщений, разделяя их строкой ~*~ (до 6 штук, каждое до 700 символов). При нескольких сообщениях они будут отправляться по очереди с каждым интервалом.'
    },    
    forbiddenWordsEnabled: {
        name: 'Обнаружение запрещённых слов',
        description: 'Включить автоматическое обнаружение запрещённых слов в сообщениях. При обнаружении будет отправлен репорт в чат модерации.'
    },
    forbiddenWordsList: {
        name: 'Список запрещённых слов',
        description: 'Список слов через запятую. Например: дурак, идиот. Бот будет проверять все формы слов и способы обхода через спецсимволы, не надо добавлять разные формы одного слова.'
    }
};


async function handleCaptchaVerification(chatId, userId, messageId) {
    try {
        await bot.restrictChatMember(chatId, userId, {
            can_send_messages: true,
            can_send_media_messages: true,
            can_send_polls: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true,
            can_react_to_messages: true
        });

        const keyboard = {
            inline_keyboard: []
        };
        
        try {
            await bot.editMessageReplyMarkup(
                { 
                    chat_id: chatId, 
                    message_id: messageId 
                },
                { reply_markup: keyboard }
            );
        } catch (e) {
            
            await bot.sendMessage(chatId, 'Вы успешно прошли проверку!', {
                reply_to_message_id: messageId
            });
        }

        if (captchaStates[chatId]) {
            delete captchaStates[chatId][userId];
            if (Object.keys(captchaStates[chatId]).length === 0) {
                delete captchaStates[chatId];
            }
        }

    } catch (e) {
        console.error('Captcha verification error:', e);
    }
}

function generateMathProblem() {
    const operations = ['+', '-', '*', '/'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    let a, b, correctAnswer, question;
    
    switch(operation) {
        case '+':
            a = Math.floor(Math.random() * 20) + 1;
            b = Math.floor(Math.random() * 20) + 1;
            correctAnswer = a + b;
            question = `${a} + ${b} = ?`;
            break;
        case '-':
            a = Math.floor(Math.random() * 20) + 1;
            b = Math.floor(Math.random() * a) + 1;
            correctAnswer = a - b;
            question = `${a} - ${b} = ?`;
            break;
        case '*':
            a = Math.floor(Math.random() * 10) + 1;
            b = Math.floor(Math.random() * 10) + 1;
            correctAnswer = a * b;
            question = `${a} × ${b} = ?`;
            break;
        case '/':
            b = Math.floor(Math.random() * 10) + 1;
            correctAnswer = Math.floor(Math.random() * 10) + 1;
            a = b * correctAnswer; 
            question = `${a} ÷ ${b} = ?`;
            break;
    }
    
    
    const options = new Set();
    options.add(correctAnswer);
    
    
    let attempts = 0;
    while (options.size < 4 && attempts < 100) {
        let wrongAnswer;
        const offset = Math.floor(Math.random() * 10) + 1;
        if (Math.random() > 0.5) {
            wrongAnswer = correctAnswer + offset;
        } else {
            wrongAnswer = Math.max(0, correctAnswer - offset);
        }
        if (wrongAnswer !== correctAnswer && wrongAnswer >= 0) {
            options.add(wrongAnswer);
        }
        attempts++;
    }
    
    
    let fallback = 0;
    while (options.size < 4) {
        if (!options.has(fallback) && fallback !== correctAnswer) {
            options.add(fallback);
        }
        fallback++;
    }
    
    
    const shuffledOptions = Array.from(options).sort(() => Math.random() - 0.5);
    
    return {
        question: question,
        correctAnswer: correctAnswer,
        options: shuffledOptions
    };
}

setInterval(async () => {
    try {
        const now = Date.now();
        const timeoutMinutes = 5;
        const timeoutMs = timeoutMinutes * 60 * 1000;

        for (const chatId of Object.keys(captchaStates)) {
            const chatData = captchaStates[chatId];
            if (!chatData) continue;

            let settings;
            try {
                settings = getChatSettings(chatId);
            } catch (e) {
                continue;
            }

            if (!settings.captchaKickEnabled) {
                continue;
            }

            for (const userId of Object.keys(chatData)) {
                const userData = chatData[userId];
                if (!userData) continue;

                if (now - userData.sentAt > timeoutMs) {
                    try {
                        await bot.banChatMember(parseInt(chatId), parseInt(userId));
                        await bot.unbanChatMember(parseInt(chatId), parseInt(userId));

                        if (userData.messageId) {
                            try {
                                const member = await bot.getChatMember(parseInt(chatId), parseInt(userId));
                                let newText = settings.welcomeMessageText || 'Добро пожаловать в чат, ?name!';
                                const mention = `<a href="tg://user?id=${userId}">${member.user.first_name}</a>`;
                                newText = newText.replace(/\?name/g, mention);
                                newText += '\n\nВремя проверки истекло. Пользователь исключён из чата.';

                                await bot.editMessageText(newText, {
                                    chat_id: parseInt(chatId),
                                    message_id: userData.messageId,
                                    parse_mode: 'HTML',
                                    reply_markup: { inline_keyboard: [] }
                                });
                            } catch (e) {
                                console.error('Error editing captcha message on kick:', e);
                            }
                        }
                        

                        
                        delete chatData[userId];


                    } catch (e) {
                        console.error(`Error kicking user ${userId} from chat ${chatId}:`, e);
                        
                        delete chatData[userId];
                    }
                }
            }

            if (Object.keys(chatData).length === 0) {
                delete captchaStates[chatId];
            }
        }
    } catch (e) {
        console.error('Captcha timeout checker error:', e);
    }
}, 30 * 1000); 

const SETTINGS_PAGE_SIZE = 6;
function getSettingsKeys() {
    return Object.keys(SETTINGS_NAMES);
}

function getTotalSettingsPages() {
    const keys = getSettingsKeys();
    return Math.ceil(keys.length / SETTINGS_PAGE_SIZE);
}

function getSettingsPage(page) {
    const keys = getSettingsKeys();
    const totalPages = getTotalSettingsPages();
    if (page < 0) page = 0;
    if (page >= totalPages) page = totalPages - 1;
    
    const start = page * SETTINGS_PAGE_SIZE;
    const end = Math.min(start + SETTINGS_PAGE_SIZE, keys.length);
    const pageKeys = keys.slice(start, end);
    
    return {
        keys: pageKeys,
        page: page,
        totalPages: totalPages,
        hasPrev: page > 0,
        hasNext: page < totalPages - 1
    };
}
const SETTINGS_DIR = path.join(__dirname, 'chat_settings');

if (!fs.existsSync(SETTINGS_DIR)) fs.mkdirSync(SETTINGS_DIR);

const defaultSettings = {
    modchatID: null, 
    commandCd: 15,
    warnExpireTime: '1M',
    warnPunishmentCount: 3, 
    warnPunishment: {
        type: 'mute', 
        duration: null 
    },
    quickMuteDuration: '3h', 
    autoComment: false, 
    autoCommentText: 'Если вы видите этот текст, то вы не настроили текст авто-комментария в боте. Настройте его, используя /settings или выключите настройку autocomment', // Текст авто-комментария
    autoCommentTextEnd: '\n\nПриятного вам использования бота',
    allowKickme: false,
    mediaRestrictionEnabled: false,
    mediaRestrictionDuration: '2m', 
    autoRaidMode: false,
    raidSensitivity: 3,
    autoDeleteEnabled: false,
    autoDeleteDuration: '3m',
    welcomeMessageEnabled: false,
    welcomeMessageText: 'Добро пожаловать в чат, ?name!',
    captchaEnabled: false,
    captchaType: 'simple',
    captchaKickEnabled: false,
    autoMessageEnabled: false,
    autoMessageInterval: '1h',
    autoMessageText: 'Это автоматическое сообщение от бота!',
    forbiddenWordsEnabled: false,
    forbiddenWordsList: 'слово1, слово2'
};
const pendingDeletions = new Map(); 

function scheduleDeletion(chatId, messageIds, duration) {
    const key = `${chatId}_${Date.now()}_${Math.random()}`;
    const timeout = setTimeout(async () => {
        try {
            for (const msgId of messageIds) {
                try {
                    await bot.deleteMessage(chatId, msgId);
                } catch (e) {
                }
            }
        } catch (e) {
            console.error('Auto-delete error:', e);
        }
        for (const [k, v] of pendingDeletions) {
            if (v === timeout) {
                pendingDeletions.delete(k);
                break;
            }
        }
    }, duration * 1000);
    
    const key2 = `${chatId}_${messageIds.join('_')}`;
    pendingDeletions.set(key2, timeout);
    
    return { key: key2, timeout };
}
function getSettingsFile(chatId) {
    return path.join(SETTINGS_DIR, `${chatId}_settings.json`);
}
async function sendMessageWithAutoDelete(chatId, text, options = {}, duration = null) {
    const settings = getChatSettings(chatId);
    
    if (!settings.autoDeleteEnabled || chatId.toString().startsWith('-') === false) {
        return bot.sendMessage(chatId, text, options);
    }
    
    const deleteDuration = duration || ParseDuration(settings.autoDeleteDuration);
    if (!deleteDuration || deleteDuration <= 0) {
        return bot.sendMessage(chatId, text, options);
    }
    
    const sent = await bot.sendMessage(chatId, text, options);
    
    scheduleDeletion(chatId, [sent.message_id], deleteDuration);
    
    return sent;
}
async function deleteCommandAndResponse(chatId, commandMsgId, botMsgId, duration) {
    const settings = getChatSettings(chatId);
    if (!settings.autoDeleteEnabled) return;
    
    const deleteDuration = duration || ParseDuration(settings.autoDeleteDuration);
    if (!deleteDuration || deleteDuration <= 0) return;
    
    const messageIds = [commandMsgId];
    if (botMsgId) messageIds.push(botMsgId);
    
    scheduleDeletion(chatId, messageIds, deleteDuration);
}
function loadChatSettings(chatId) {
    const file = getSettingsFile(chatId);
    
    if (!fs.existsSync(file)) {
        const settings = JSON.parse(JSON.stringify(defaultSettings));
        saveChatSettings(chatId, settings);
        return settings;
    }
    
    try {
        const raw = fs.readFileSync(file, 'utf8');
        const settings = JSON.parse(raw);
        
        // Глубокое копирование для защиты от мутаций
        const merged = JSON.parse(JSON.stringify({ ...defaultSettings, ...settings }));
        
        if (!merged.warnPunishment) {
            merged.warnPunishment = JSON.parse(JSON.stringify(defaultSettings.warnPunishment));
        } else {
            merged.warnPunishment = JSON.parse(JSON.stringify({ ...defaultSettings.warnPunishment, ...merged.warnPunishment }));
        }
        
        return merged;
    } catch (e) {
        console.error(`Ошибка загрузки настроек для чата ${chatId}:`, e);
        return JSON.parse(JSON.stringify(defaultSettings));
    }
}

function saveChatSettings(chatId, settings) {
    const file = getSettingsFile(chatId);
    const tmp = file + '.tmp';
    
    fs.writeFileSync(tmp, JSON.stringify(settings, null, 2));
    fs.renameSync(tmp, file);
}

function updateChatSetting(chatId, key, value) {
    const settings = loadChatSettings(chatId);
    
    if (key.includes('.')) {
        const parts = key.split('.');
        let current = settings;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
    } else {
        settings[key] = value;
    }
    
    saveChatSettings(chatId, settings);
    return settings;
}

const settingsCache = new Map();

function getChatSettings(chatId) {
    if (!settingsCache.has(chatId)) {
        settingsCache.set(chatId, loadChatSettings(chatId));
    }
    return settingsCache.get(chatId);
}

function invalidateSettingsCache(chatId) {
    settingsCache.delete(chatId);
}
function getSettingType(value) {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (value === null) return 'null';
    return 'string';
}

function formatSettingValue(value) {
    if (value === null) return 'Не установлено (null)';
    if (typeof value === 'boolean') return value ? 'Включено' : 'Выключено';
    if (typeof value === 'string' && value === '') return ' Не установлено (пусто)';
    return String(value);
}

function getSettingDisplayName(key) {
    return SETTINGS_NAMES[key]?.name || key;
}

function getSettingDescription(key) {
    return SETTINGS_NAMES[key]?.description || 'Нет описания';
}

function getNestedValue(obj, key) {
    if (key.includes('.')) {
        const parts = key.split('.');
        let current = obj;
        for (const part of parts) {
            if (current === undefined || current === null) return undefined;
            current = current[part];
        }
        return current;
    }
    return obj[key];
}

async function showSettingsMenu(chatId, messageId = null, page = 0) {
    const settings = getChatSettings(chatId);
    const pageData = getSettingsPage(page);
    
    let text = '<b>Настройки чата</b>\n\n';
    text += `Страница ${pageData.page + 1} из ${pageData.totalPages}\n\n`;

    const buttons = [];
    
    for (const key of pageData.keys) {
        const displayName = getSettingDisplayName(key);
        buttons.push([{ 
            text: displayName, 
            callback_data: `settings_edit_${key}` 
        }]);
    }

    const navButtons = [];
    if (pageData.hasPrev) {
        navButtons.push({ text: '<', callback_data: `settings_page_${pageData.page - 1}` });
    }
    if (pageData.hasNext) {
        navButtons.push({ text: '>', callback_data: `settings_page_${pageData.page + 1}` });
    }
    if (navButtons.length > 0) {
        buttons.push(navButtons);
    }

    const keyboard = {
        inline_keyboard: buttons
    };

    if (messageId) {
        try {
            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
            return { message_id: messageId };
        } catch (e) {
            console.error('Edit settings message error:', e);
            const sent = await bot.sendMessage(chatId, text, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
            return sent;
        }
    } else {
        const sent = await bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
        return sent;
    }
}

async function showSettingEdit(chatId, messageId, key) {
    const settings = getChatSettings(chatId);

    const value = getNestedValue(settings, key);
    const defaultValue = getNestedValue(defaultSettings, key);
    const displayName = getSettingDisplayName(key);
    const description = getSettingDescription(key);
    const type = getSettingType(value);

    let text = `<b>Настройка: ${displayName}</b>\n\n`;
    text += `<b>Название переменной:</b> <code>${key}</code>\n`;
    text += `<b>Текущее значение:</b> ${formatSettingValue(value)}\n`;
    text += `<b>Значение по умолчанию:</b> ${formatSettingValue(defaultValue)}\n`;
    text += `<b>Тип:</b> ${type}\n\n`;
    text += `<b>Описание:</b> ${description}`;

    const buttons = [];

    if (type === 'boolean') {
        buttons.push([
            { text: 'Включить', callback_data: `settings_set_${key}_true` },
            { text: 'Выключить', callback_data: `settings_set_${key}_false` }
        ]);
    } else {
        buttons.push([
            { text: 'Установить значение', callback_data: `settings_input_${key}` }
        ]);
    }

    buttons.push([
        { text: 'По умолчанию', callback_data: `settings_reset_${key}` },
        { text: 'Назад', callback_data: 'settings_back' }
    ]);

    const keyboard = {
        inline_keyboard: buttons
    };

    if (settingsInputStates[chatId]) {
        settingsInputStates[chatId].returnPage = settingsInputStates[chatId].currentPage || 0;
    }

    try {
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
    } catch (e) {
        console.error('Edit setting error:', e);
        const sent = await bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
        if (settingsInputStates[chatId]) {
            settingsInputStates[chatId].menuMessageId = sent.message_id;
        }
    }
}

async function checkAdmin(chatId, userId) {
    try {
        const admins = await bot.getChatAdministrators(chatId);
        return admins.some(a => a.user.id === userId);
    } catch {
        return false;
    }
}




// поддержка
const supportChat = '-1003986752214';
const ticketCreationStates = {};
const confirmCloseStates = {}; 


// кд команд
var lastcommand = 0;
setInterval(function() {
    lastcommand++
}, 1000)
// мут, бан, варн и тд
function ParseDuration(str) {
    if(!str) return null;

    const match = str.match(/^(\d+)([mhdM])$/);
    if(!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
        m:  60,
        h: 3600,
        d: 86400,
        M: 2500000
    };
    return value * multipliers[unit]
};
function formatDuration(seconds) {
    if (seconds % 2500000 === 0) {
        return `${seconds / 2500000} мес.`;
    }
    if (seconds % 86400 === 0) {
        return `${seconds / 86400} д.`;
    }
    if (seconds % 3600 === 0) {
        return `${seconds / 3600} час.`;
    }
    return `${seconds / 60} мин.`;
}
async function ResolveUser(bot, chatId, input) {
    if(!input) return {ok: false};

    try{
        if(/^\d+$/.test(input)){
            const member = await bot.getChatMember(chatId, parseInt(input));
            return {ok: true, id: member.user.id};
        }
        if (input.startsWith('@')) {
            const member = await bot.getChatMember(chatId, input);
            return { ok: true, id: member.user.id };
        }
    } catch(e) {
        return {ok: false};
    }
    return {ok: false};
};
function getUserFromEntities(msg) {
    if (!msg.entities) return null;

    for (const ent of msg.entities) {
        if (ent.type === 'mention') {
            return msg.text.substring(ent.offset, ent.offset + ent.length);
        }
    }
    return null;
}
async function getUserMention(chatId, userId) {
    try {
        const member = await bot.getChatMember(chatId, userId);
        const name = member.user.first_name;
        return `<a href="tg://user?id=${userId}">${name}</a>`;
    } catch {
        return `ID: ${userId}`;
    }
}

//json логи

function getChatLogFile(chatId) {
    return path.join(CHAT_LOG_DIR, `${chatId}_logs.json`);
}

function getUserLogFile(userId) {
    return path.join(USER_LOG_DIR, `${userId}_logs.json`);
}
function loadJSON(file) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify({}, null, 2));
            return {};
        }

        const raw = fs.readFileSync(file, 'utf8');

        if (!raw || raw.trim().length === 0) {
            return {};
        }

        return JSON.parse(raw);
    } catch (e) {
        console.error(`Broken JSON file: ${file}`, e);

        return {};
    }
}

function saveJSON(file, data) {
    const tmp = file + '.tmp';

    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
}

function getUser(logs, userId) {
    if (!logs[userId]) {
        logs[userId] = {
            totalPunishments: 0,
            mutes: [],
            notes: [],
            bans: [],
            warns: [],
            reportsSent: [],
            reportsReceived: []
        };
    }
    return logs[userId];
}
function formatDateMSK(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
function loadUserLogs(userId) {
    return loadJSON(getUserLogFile(userId));
}

function saveUserLogs(userId, data) {
    return saveJSON(getUserLogFile(userId), data);
}
function loadLogs(chatId) {
     const file = getChatLogFile(chatId); 
     if (!fs.existsSync(file)) {
         fs.writeFileSync(file, JSON.stringify({}, null, 2)); 
         return {}; 
    } return JSON.parse(fs.readFileSync(file));
} 
function saveLogs(chatId, data) { 
    const file = getChatLogFile(chatId); 
    fs.writeFileSync(file, JSON.stringify(data, null, 2)); 
}
function getUser(logs, userId) {
    if (!logs[userId]) {
        logs[userId] = {
            totalPunishments: 0,
            mutes: [],
            notes: [],
            bans: [],
            warns: [],
            reportsSent: [],
            reportsReceived: []
        };
    }

    const user = logs[userId];
    if (!user.mutes) user.mutes = [];
    if (!user.notes) user.notes = [];
    if (!user.bans) user.bans = [];
    if (!user.warns) user.warns = [];
    if (!user.reportsSent) user.reportsSent = [];
    if (!user.reportsReceived) user.reportsReceived = [];

    return user;
}
function getUserGlobal(logs, userId) {
    if (!logs[userId]) {
        logs[userId] = {
            totalPunishments: 0,
            mutes: [],
            notes: [],
            bans: [],
            warns: [],
            reportsSent: [],
            reportsReceived: []
        };
    }

    const user = logs[userId];

    if (!user.mutes) user.mutes = [];
    if (!user.notes) user.notes = [];
    if (!user.bans) user.bans = [];
    if (!user.warns) user.warns = [];
    if (!user.reportsSent) user.reportsSent = [];
    if (!user.reportsReceived) user.reportsReceived = [];

    return user;
}
function pushGlobalLog(userId, chatId, event) {
    const logs = loadUserLogs(userId);
    const user = getUserGlobal(logs, userId);

    user.totalPunishments++;

    user.mutes.push({
        ...event,
        chatId: chatId 
    });

    saveUserLogs(userId, logs);
}
function markReportAsChecked(chatId, messageId, adminId) {
    const chatLogs = loadLogs(chatId);
    if (!chatLogs._reports) return false;
    const report = chatLogs._reports.find(r => r.reportMessageId === messageId);
    if (!report || report.checked) return false;

    report.checked = true;
    report.checkedAt = new Date().toISOString();
    report.checkedBy = adminId;
    saveLogs(chatId, chatLogs);

    
    const reporterLogs = loadUserLogs(report.reporterId);
    const reporterUser = getUserGlobal(reporterLogs, report.reporterId);
    const sentReport = reporterUser.reportsSent.find(r => r.reportMessageId === messageId && r.chatId == chatId);
    if (sentReport) {
        sentReport.checked = true;
        sentReport.checkedAt = report.checkedAt;
        sentReport.checkedBy = adminId;
    }
    saveUserLogs(report.reporterId, reporterLogs);

    
    const offenderLogs = loadUserLogs(report.offenderId);
    const offenderUser = getUserGlobal(offenderLogs, report.offenderId);
    const receivedReport = offenderUser.reportsReceived.find(r => r.reportMessageId === messageId && r.chatId == chatId);
    if (receivedReport) {
        receivedReport.checked = true;
        receivedReport.checkedAt = report.checkedAt;
        receivedReport.checkedBy = adminId;
    }
    saveUserLogs(report.offenderId, offenderLogs);

    return true;
}

// bot.js — добавьте после функции getUserFromEntities

// === ОБНАРУЖЕНИЕ ЗАПРЕЩЁННЫХ СЛОВ ===

// Функция для нормализации текста (удаление спецсимволов, приведение к одному регистру)
function normalizeText(text) {
    if (!text) return '';
    
    // Приводим к нижнему регистру
    let normalized = text.toLowerCase();
    
    // Заменяем распространённые замены букв
    const replacements = {
        'а': '[аa@4]',
        'б': '[бb6]',
        'в': '[вb]',
        'г': '[гg]',
        'д': '[дd]',
        'е': '[еe3]',
        'ё': '[ёe]',
        'ж': '[ж]',
        'з': '[зz3]',
        'и': '[иi]',
        'й': '[йi]',
        'к': '[кk]',
        'л': '[лl]',
        'м': '[мm]',
        'н': '[нn]',
        'о': '[оo0]',
        'п': '[пp]',
        'р': '[рr]',
        'с': '[сc5]',
        'т': '[тt]',
        'у': '[уy]',
        'ф': '[фf]',
        'х': '[хx]',
        'ц': '[цc]',
        'ч': '[ч]',
        'ш': '[ш]',
        'щ': '[щ]',
        'ъ': '[ъ]',
        'ы': '[ы]',
        'ь': '[ь]',
        'э': '[эe]',
        'ю': '[юy]',
        'я': '[я]'
    };
    
    // Заменяем буквы на их возможные вариации
    let result = normalized;
    for (const [key, value] of Object.entries(replacements)) {
        result = result.replace(new RegExp(key, 'g'), value);
    }
    
    return result;
}

// Функция для проверки слова на соответствие шаблону
function matchesForbiddenWord(word, forbiddenWord) {
    if (!word || !forbiddenWord) return false;
    
    const normalizedWord = normalizeText(word);
    const normalizedForbidden = normalizeText(forbiddenWord);
    
    // Проверяем, содержит ли слово запрещённое слово (с учётом окончаний)
    const patterns = [
        // Точное совпадение
        new RegExp(`^${normalizedForbidden}$`),
        // Слово может иметь окончания
        new RegExp(`^${normalizedForbidden}[а-яa-z]*$`),
        // Запрещённое слово может быть частью слова
        new RegExp(`${normalizedForbidden}`)
    ];
    
    // Проверяем все варианты написания с учётом замен
    const variations = generateVariations(normalizedForbidden);
    for (const variation of variations) {
        if (normalizedWord.includes(variation)) {
            return true;
        }
    }
    
    return false;
}

// Функция для генерации вариаций слова (учёт разных замен)
function generateVariations(word) {
    const variations = new Set();
    variations.add(word);
    
    // Если слово уже содержит замены, пробуем варианты
    const chars = word.split('');
    const possibleChars = [];
    
    for (const char of chars) {
        const alternatives = getAlternatives(char);
        if (alternatives.length > 1) {
            possibleChars.push(alternatives);
        } else {
            possibleChars.push([char]);
        }
    }
    
    // Генерируем комбинации
    function generateCombinations(index, current) {
        if (index === possibleChars.length) {
            variations.add(current);
            return;
        }
        for (const alt of possibleChars[index]) {
            generateCombinations(index + 1, current + alt);
        }
    }
    
    if (possibleChars.some(arr => arr.length > 1)) {
        generateCombinations(0, '');
    }
    
    return Array.from(variations);
}

// Функция для получения альтернатив для символа
function getAlternatives(char) {
    const alternatives = {
        'а': ['а', 'a', '@', '4'],
        'б': ['б', 'b', '6'],
        'в': ['в', 'b'],
        'г': ['г', 'g'],
        'д': ['д', 'd'],
        'е': ['е', 'e', '3'],
        'ё': ['ё', 'e'],
        'з': ['з', 'z', '3'],
        'и': ['и', 'i'],
        'к': ['к', 'k'],
        'л': ['л', 'l'],
        'м': ['м', 'm'],
        'н': ['н', 'n'],
        'о': ['о', 'o', '0'],
        'п': ['п', 'p'],
        'р': ['р', 'r'],
        'с': ['с', 'c', '5'],
        'т': ['т', 't'],
        'у': ['у', 'y'],
        'ф': ['ф', 'f'],
        'х': ['х', 'x'],
        'ц': ['ц', 'c'],
        'ы': ['ы', 'y'],
        'э': ['э', 'e'],
        'ю': ['ю', 'y']
    };
    return alternatives[char] || [char];
}

// Функция для проверки текста на наличие запрещённых слов
function checkForbiddenWords(text, forbiddenWordsList) {
    if (!text || !forbiddenWordsList) return null;
    
    const words = forbiddenWordsList.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
    if (words.length === 0) return null;
    
    // Разбиваем текст на слова (учитывая пунктуацию)
    const textWords = text.split(/\s+/);
    
    for (const forbiddenWord of words) {
        for (const word of textWords) {
            // Очищаем слово от пунктуации для сравнения
            const cleanWord = cleanText(word);
            if (!cleanWord) continue;
            
            // Проверяем точное совпадение или совпадение с окончаниями
            // но только если запрещённое слово является отдельным словом или корнем с окончанием
            if (isForbiddenWordMatch(cleanWord, forbiddenWord)) {
                return {
                    foundWord: forbiddenWord,
                    matchedWord: word,
                    fullText: text
                };
            }
        }
    }
    
    return null;
}

// Функция для проверки соответствия слова запрещённому слову
function isForbiddenWordMatch(word, forbiddenWord) {
    if (!word || !forbiddenWord) return false;
    
    // Точное совпадение
    if (word === forbiddenWord) return true;
    
    // Проверяем, является ли слово формой запрещённого слова
    // Например: "жиды" -> "жид", "жидовский" -> "жид"
    // Но не "неожиданно" -> "жид"
    
    // Если запрещённое слово короче 3 букв, требуем точного совпадения или 
    // чтобы слово начиналось с запрещённого и заканчивалось на типичное окончание
    if (forbiddenWord.length <= 3) {
        // Для коротких слов (3 буквы и меньше) — только точное совпадение
        // или слово из 4-5 букв, которое начинается с запрещённого и имеет типичное окончание
        const typicalEndings = ['ы', 'а', 'ов', 'ев', 'ский', 'ская', 'ское', 'ие', 'ий', 'ой', 'ом', 'е'];
        for (const ending of typicalEndings) {
            if (word === forbiddenWord + ending) return true;
        }
        return false;
    }
    
    // Для длинных слов — проверяем, является ли запрещённое слово корнем
    // Но только если слово начинается с запрещённого и разница в длине не более 4 символов
    if (word.startsWith(forbiddenWord)) {
        const diff = word.length - forbiddenWord.length;
        // Разрешаем только типичные окончания (не более 4 символов)
        if (diff > 0 && diff <= 4) {
            const ending = word.slice(forbiddenWord.length);
            const typicalEndings = ['ы', 'а', 'ов', 'ев', 'ский', 'ская', 'ское', 'ие', 'ий', 'ой', 'ом', 'е', 'ам', 'ами', 'ах'];
            for (const typical of typicalEndings) {
                if (ending === typical) return true;
            }
        }
        return false;
    }
    
    return false;
}


async function executeQuickAction(query, action, chatId, messageId, report) {
    const adminId = query.from.id;
    const offenderId = report.offenderId;
    let punishmentText = '';
    const settings = getChatSettings(chatId);

    try {
        if (action === 'report_warn') {
            const reason = report.reason ? `Быстрый ответ на репорт: ${report.reason}` : 'Быстрый ответ на репорт';
            const warnEntry = {
                active: true,
                permanent: false,
                issuedAt: new Date().toISOString(),
                messageText: report.messageText || null,
                messageId: report.messageId || null,
                reason: reason,
                adminId: adminId,
                removedAt: null,
                removedBy: null
            };
            const logs = loadLogs(chatId);
            const user = getUser(logs, offenderId);
            user.totalPunishments++;
            user.warns.push(warnEntry);
            saveLogs(chatId, logs);
            const ulogs = loadUserLogs(offenderId);
            const u = getUserGlobal(ulogs, offenderId);
            u.totalPunishments++;
            u.warns.push({ ...warnEntry, chatId: chatId });
            saveUserLogs(offenderId, ulogs);
            await checkWarnPunishment(chatId, offenderId);
            punishmentText = 'предупреждение';
        } else if (action === 'report_mute') {
            const duration = ParseDuration(settings.quickMuteDuration);
            if (!duration) throw new Error('Неверная длительность мута');
            const untilDate = Math.floor(Date.now() / 1000) + duration;
            await bot.restrictChatMember(chatId, offenderId, {
                permissions: {
                    can_send_messages: false,
                    can_send_media_messages: false,
                    can_send_polls: false,
                    can_send_other_messages: false,
                    can_add_web_page_previews: false,
                },
                until_date: untilDate
            });
            const muteEntry = {
                active: true,
                issuedAt: new Date().toISOString(),
                messageText: report.messageText || null,
                messageId: report.messageId || null,
                reason: report.reason ? `Быстрый ответ на репорт: ${report.reason}` : 'Быстрый ответ на репорт',
                adminId: adminId,
                expiresAt: new Date(Date.now() + duration * 1000).toISOString(),
                removedAt: null,
                removedBy: null
            };
            const logs = loadLogs(chatId);
            const user = getUser(logs, offenderId);
            user.totalPunishments++;
            user.mutes.push(muteEntry);
            saveLogs(chatId, logs);
            const ulogs = loadUserLogs(offenderId);
            const u = getUserGlobal(ulogs, offenderId);
            u.totalPunishments++;
            u.mutes.push({ ...muteEntry, chatId: chatId });
            saveUserLogs(offenderId, ulogs);
            punishmentText = `мут на ${settings.quickMuteDuration}`;
        } else if (action === 'report_ban') {
            await bot.banChatMember(chatId, offenderId);
            const banEntry = {
                active: true,
                issuedAt: new Date().toISOString(),
                messageText: report.messageText || null,
                messageId: report.messageId || null,
                reason: report.reason ? `Быстрый ответ на репорт: ${report.reason}` : 'Быстрый ответ на репорт',
                adminId: adminId,
                expiresAt: null,
                removedAt: null,
                removedBy: null
            };
            const logs = loadLogs(chatId);
            const user = getUser(logs, offenderId);
            user.totalPunishments++;
            user.bans.push(banEntry);
            saveLogs(chatId, logs);
            const ulogs = loadUserLogs(offenderId);
            const u = getUserGlobal(ulogs, offenderId);
            u.totalPunishments++;
            u.bans.push({ ...banEntry, chatId: chatId });
            saveUserLogs(offenderId, ulogs);
            punishmentText = 'бан';
        } else if (action === 'report_reject') {
            punishmentText = 'отклонён';
        } else {
            throw new Error('Неизвестное действие');
        }

        
        markReportAsChecked(chatId, messageId, adminId);

        
        const oldText = query.message.text;
        const newText = `Репорт проверен, наказание: ${punishmentText}\n\n` + oldText;
        await bot.editMessageText(newText, {
            chat_id: query.message.chat.id,
            message_id: messageId,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: {} 
        });

        
        if (reportStates[messageId]) {
            clearTimeout(reportStates[messageId].timer);
            delete reportStates[messageId];
        }

        bot.answerCallbackQuery(query.id, { text: `Выполнено: ${punishmentText}` });
    } catch (e) {
        console.error('Execute quick action error:', e);
        bot.answerCallbackQuery(query.id, { text: 'Ошибка при выполнении действия', show_alert: true });
    }
}
function loadTickets() {
    return loadJSON(TICKETS_FILE);
}
function saveTickets(data) {
    saveJSON(TICKETS_FILE, data);
}
function loadRatings() {
    return loadJSON(RATINGS_FILE);
}
function saveRatings(data) {
    saveJSON(RATINGS_FILE, data);
}
function generateTicketNumber() {
    const tickets = loadTickets();
    let max = 0;
    for (const key of Object.keys(tickets)) {
        if (tickets[key].ticketNumber > max) max = tickets[key].ticketNumber;
    }
    return max + 1;
}
//рейд мод
const raidModeChats = new Set();
const joinTracker = {}; 


async function enableRaidMode(chatId) {
    if (raidModeChats.has(chatId)) return;

    raidModeChats.add(chatId);

    try {
        await bot.setChatPermissions(chatId, {
            can_send_messages: false,
            can_send_media_messages: false,
            can_send_polls: false,
            can_send_other_messages: false,
            can_add_web_page_previews: false,
            can_change_info: false,
            can_invite_users: false,
            can_pin_messages: false
        });
        bot.sendSticker(chatId, 'CAACAgIAAxkBAAEEKxtqFAYd9VqU8LwWcXcDf1co9MumMQACYksAAlHuGEkXVzfvKmVhfTsE')
        bot.sendMessage(
            chatId,
            'Я обнаружила возможный рейд! Активирован агрессивный режим антиспама и антирейда!\n\n' +
            '• Всем обычным участникам запрещено писать\n' +
            '• Новые пользователи будут автоматически исключаться\n' +
            '• Для отключения используйте /unRaidMode'
        );
    } catch (e) {
        bot.sendMessage(chatId, 'ВНИМАНИЕ, сейчас должен был быть активирован режим агрессивного антиспама и антирейда, но этого не вышло сделать! Я правла пыталась, но что-то пошло не так((')
        console.error('RaidMode enable error:', e);
        return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE')
    }
}

async function disableRaidMode(chatId) {
    raidModeChats.delete(chatId);

    try {
        await bot.setChatPermissions(chatId, {
            can_send_messages: true,
            can_send_media_messages: true,
            can_send_polls: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true,
            can_invite_users: true
        });

        bot.sendMessage(chatId, 'Я отключила режим агрессивного антиспама и антиреда.');
    } catch (e) {bot.sendMessage(chatId, 'Простите, я не смогла деактивировать режим агрессивного антиспама и антирейда. Я правда пыталась, но что-то пошло не так(( \n Деактивируйте его вручную, разрешив пользователям отправлять сообщения и удалив меня из чата!')
        console.error('RaidMode disable error:', e);
        return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE')
    }
}




//команды
bot.onText(/^\/start/, (msg) => {
    const chatId = msg.chat.id;
    const settings = getChatSettings(chatId);
    if(lastcommand >= settings.commandCd) {
        bot.sendMessage(chatId, 'Привет! Я Атри — лучший бот для модерации чата, ведь я — ПРОДВИНУТАЯ!', { reply_to_message_id: msg.message_id});
        bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW3Kpp2m3oeRAT7kSYyQYn50unC_LUcAACQk0AAgIrIUnHg1eVssvSCzsE', { reply_to_message_id: msg.message_id});
        lastcommand = 0;
    };
    
});
bot.onText(/^\/commands/, async (msg) => {
    const chatId = msg.chat.id;
    const settings = getChatSettings(chatId);
    if(msg.chat.type === 'private') {
        const sent = await bot.sendMessage(chatId, 'Вот, что я умею: \n <b>/help</b> — создать запрос в службу поддержки бота \n\nДля того, чтобы узнать больше о моих возможностях, используйте эту команду в чате, и в чате, в котором у вас есть права администратора, либо загляните на сайт guide.atri-bot.online \n <b>/updatesecretcode</b> — обновить свой секретный код для доступа к онлайн-панели администратора (вы уже должны быть зарегистрированы в ней.)', {parse_mode: 'HTML'})
        return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
    }
    const userId = msg.from.id;
    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some(admin => admin.user.id === userId);
    if(lastcommand >= settings.commandCd || isAdmin) {
                lastcommand = 0;
        

        try {            
            const text = 'Вот, что я умею: \n   <b>/settings</b> — открыть настройки чата\n   <b>/user</b> — узнать информацию о пользователе (ответом на его сообщение или вписав его Id после команды), флаг -f — узнать полную информацию о пользователе, флаг -mc — отправить ответ в чат модерации (если настроен) пример использования команды: /user 12345678910 -f -mc \n   <b>/note</b> — создать заметку о пользователе (ответом на сообщение или указав Id), пример использования команды: \note 12345678910 спамер, команда /unnote НОМЕР_ЗАМЕТКИ — удалить конкретную заметку о пользователе (ответом на сообщение или указав Id), номер заметки можно узнать в информации о пользователе \n   <b>/warn</b> — выдать пользователю предупреждение (ответом на его сообщение или указав его Id), можно указать причину предупреждения, флаг -d — бот удалит сообщение нарушителя (если команда написана ответом на него), флаг -i — предупреждение не исчезает со временем (если настроено время автоматического снятия предупреждений) пример использования команды: /warn 12345678910 Спам -d -i, команда /unwarn НОМЕР_ВАРНА (ответом на сообщение или указав Id) — снять конкретное предупреждение у пользователя, номер предупреждение можно посмотреть в полной информации о пользователе \n   <b>/mute</b> — запретить пользователю писать в чат (ответом на его сообщение или указав его Id), можно указать срок мута в минутах, часах, днях, месяцах буквами m,h,d,M соответственно (если время не указанно, то мут вечный), можно указать причину, флаг -d — бот удалит сообщение нарушителя (если команда написана ответом на него), пример использования команды: /mute 12345678910 5h Спам -d, команда /unmute (ответом на сообщение или указав Id) — досрочно снять ограничения с пользователя \n   <b>/ban</b> — заблокировать пользователя в чате (ответом на его сообщение или указав его Id), можно указать срок бана в минутах, часах, днях, месяцах буквами m,h,d,M соответственно (если время не указанно, то бан вечный), можно указать причину, флаг -d — бот удалит сообщение нарушителя (если команда написана ответом на него), пример использования команды: /ban 12345678910 5h Спам -d, команда /unban (ответом на сообщение или указав Id) — досрочно разблокировать пользователя \n <b>/raidMode</b> — включить режим активного антиспама и антирейда, команда /unRaidMode — отключить режим агрессивного антиспама и антирейда \n <b>/onlinepanel</b> — получить доступ к онлайн-панели администрации или добавить этот чат в онлайн-панель \n <b>/updateonlineadmins</b> — обновить список администраторов в онлайн-панели этого чата'
            if(!isAdmin) {
                const sent = await bot.sendMessage(chatId, 'Вот, что я умею: \n   <b>/user</b> — узнать информацию о себе \n   <b>/report</b> — сообщить о нарушителе в чате (ответом на его сообщение) \n   <b>/help</b> — создать запрос в службу поддержки бота', {parse_mode: 'HTML', reply_to_message_id: msg.message_id})
                return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
            }
            if(isAdmin) {
                const sent = await bot.sendMessage(chatId, text, {parse_mode: 'HTML', reply_to_message_id: msg.message_id}) 
                return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                
            }           
        } catch (error) {
            console.error(error, ' 1');
        }
        
    };
    
});
bot.onText(/\/mute(?:\s+(.+))?/, async (msg,match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if(msg.chat.type === 'private' || msg.chat.type === 'channel') {
        return bot.sendMessage(chatId, 'Я могу сделать это только в группе')
    }
    const settings = getChatSettings(chatId);
    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some(admin => admin.user.id === userId);
    if(lastcommand >= settings.commandCd || isAdmin) {
        try {
            
            if(msg.chat.type === 'private') {
                return bot.sendMessage(chatId, 'Я могу сделать это только в группе', { reply_to_message_id: msg.message_id})
            } else {
                if(isAdmin) {
                    let args = (match[1] || '').trim().split(/\s+/).filter(Boolean);

                    let targetId = null;
                    let duration = null;
                    let reason = '';
                    let deleteFlag = false;
                    let userReply = false;

                    if(msg.reply_to_message) {
                        targetId = msg.reply_to_message.from.id;
                        userReply = true;
                    } else if (args.length) {
                        let userInput = args[0];
                        
                        const entityMention = getUserFromEntities(msg);
                        if (entityMention) {
                            userInput = entityMention;
                        }

                        const result = await ResolveUser(bot, chatId, userInput);

                        if (!result.ok) {
                            const sent = await bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                                reply_to_message_id: msg.message_id
                            });
                            return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                        }

                        targetId = result.id;
                        args.shift();
                    }

                    if(targetId === null) {
                        const sent = await bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', { reply_to_message_id: msg.message_id})
                        return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                    }

                    // флаги
                    if(userReply && args.includes('-d')){
                        deleteFlag = true;
                        args =args.filter(a => a !== '-d')
                    }
                    
                    if(args.length && ParseDuration(args[0])) {
                        duration = ParseDuration(args[0]);
                        args.shift();
                    }

                    reason = args.join(' ');
                    
                    const isTargetAdmin = admins.some(admin => admin.user.id === targetId)
                    if(!isTargetAdmin) {
                        try {
                            let untilDate = 0;

                            if(duration) {
                                untilDate = Math.floor(Date.now() / 1000) + duration;
                            }

                            await bot.restrictChatMember(chatId, targetId, {
                                permissions: {
                                    can_send_messages: false,
                                    can_send_media_messages: false,
                                    can_send_polls: false,
                                    can_send_other_messages: false,
                                    can_add_web_page_previews: false,
                                    can_react_to_messages: false
                                },                            
                                until_date: untilDate
                            });

                            if(deleteFlag && msg.reply_to_message) {
                                try {
                                    await bot.deleteMessage(chatId, msg.reply_to_message.message_id);
                                } catch (e) {return}
                            }

                            const target = await bot.getChatMember(chatId, targetId);
                            const targetName = target.user.first_name;

                            const mention = `<a href="tg://user?id=${targetId}">${targetName}</a>`;

                            let text = `Я запретила пользователю ${mention}`;

                            if (duration) {
                                text += ` писать в чат на ${formatDuration(duration)}`;
                            } else {
                                text += ` писать в чат навсегда`;
                            }

                            if (reason) {
                                text += ` по причине '${reason}'`;
                            }

                            const sent = await bot.sendMessage(chatId, text, {
                                parse_mode: 'HTML',
                                reply_to_message_id: msg.message_id
                            });
                            await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                            const logs = loadLogs(chatId);
                            const userLog = getUser(logs, targetId);

                            userLog.totalPunishments++;

                            const log = ({
                                active: true,
                                issuedAt: new Date().toISOString(),
                                messageText: msg.reply_to_message ? msg.reply_to_message.text || null : null,
                                messageId: msg.reply_to_message ? msg.reply_to_message.message_id : null,
                                reason,
                                adminId: msg.from.id,
                                expiresAt: duration ? new Date(Date.now() + duration * 1000).toISOString() : null,
                                removedAt: null,
                                removedBy: null
                            });
                            if (!userLog.mutes) userLog.mutes = [];
                            userLog.mutes.push(log);
                            saveLogs(chatId, logs);

                            
                            const ulogs = loadUserLogs(targetId);
                            const u = getUserGlobal(ulogs, targetId);

                            u.totalPunishments++;

                            u.mutes.push({
                                ...log,
                                chatId
                            });

                            saveUserLogs(targetId, ulogs);
                        } catch (err) {
                            bot.sendMessage(chatId, 'Простите, я не смогла запретить этому пользователю писать в чат. Я правда пыталась, но что-то пошло не так((', { reply_to_message_id: msg.message_id})
                            return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
                        }
                    } else {
                        const sent = await bot.sendMessage(chatId, 'Я не могу наказать другого администратора', { reply_to_message_id: msg.message_id})
                        return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                    }
                } else {
                    const sent = await bot.sendMessage(chatId, 'Похоже вы не обадаете правми администратора в этой группе', { reply_to_message_id: msg.message_id});
                    return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                }
            }
            
        } catch (error) {
            return console.error(error, '2');
        }
        lastcommand = 0;
    }
    
})
bot.onText(/\/unmute(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if(msg.chat.type === 'private' || msg.chat.type === 'channel') {
        return bot.sendMessage(chatId, 'Я могу сделать это только в группе')
    }
    const settings = getChatSettings(chatId);
    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some(admin => admin.user.id === userId);
    if(lastcommand >= settings.commandCd || isAdmin) {
        if(msg.chat.type === 'private') {
            return bot.sendMessage(chatId, 'Я могу сделать это только в группе', { reply_to_message_id: msg.message_id})
        } else {
            try {
                
                let args = (match[1] || '').trim().split(/\s+/).filter(Boolean);
                if (!isAdmin) {
                    const sent = await bot.sendMessage(chatId, 'Похоже вы не обадаете правми администратора в этой группе', {
                        reply_to_message_id: msg.message_id
                    });
                    return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                }

                let targetId = null;

                if (msg.reply_to_message) {
                    targetId = msg.reply_to_message.from.id;
                    userReply = true;
                } else if (args.length) {
                    const entityMention = getUserFromEntities(msg);
                    let input = entityMention || args[0];

                    const res = await ResolveUser(bot, chatId, input);
                    if (!res.ok) {
                        const sent = await bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                            reply_to_message_id: msg.message_id
                        });
                        return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                    }

                    targetId = res.id;
                    args.shift();
                }

                await bot.restrictChatMember(chatId, targetId, {
                    can_send_messages: true,
                    can_send_media_messages: true,
                    can_send_polls: true,
                    can_send_other_messages: true,
                    can_add_web_page_previews: true,
                    can_react_to_messages: true
                });

                const target = await bot.getChatMember(chatId, targetId);
                const targetName = target.user.first_name;
                const mention = `<a href="tg://user?id=${targetId}">${targetName}</a>`;
                const sent = await bot.sendMessage(chatId,
                    `Пользователь ${mention} снова может писать! С возвращением!`,
                    { parse_mode: 'HTML', reply_to_message_id: msg.message_id }
                );
                await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                const logs = loadLogs(chatId);
                const userLog = getUser(logs, targetId);

                const activeMute = [...userLog.mutes].reverse().find(m => m.active);

                if (activeMute) {
                    activeMute.active = false;
                    activeMute.removedAt = new Date().toISOString();
                    activeMute.removedBy = userId;
                }

                saveLogs(chatId, logs);
                const ulogs = loadUserLogs(targetId);
                const u = getUserGlobal(ulogs, targetId);

                const last = [...u.mutes].reverse().find(m => m.active);

                if (last) {
                    last.active = false;
                    last.removedAt = new Date().toISOString();
                    last.removedBy = msg.from.id;
                }

                saveUserLogs(targetId, ulogs);

            } catch (err) {
                console.error(err, '3');
                bot.sendMessage(chatId, 'Простите, я не смогла снять ограничения. Я правда пыталась, но что-то пошло не так((', { reply_to_message_id: msg.message_id});
                return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
            }
            lastcommand = 0;
        }
        
    }
    
});
bot.onText(/^\/kickme/, async (msg) => {
    const chatId = msg.chat.id;
    const settings = getChatSettings(chatId);
    if(msg.chat.type === 'private' || msg.chat.type === 'channel') {
        return bot.sendMessage(chatId, 'Я могу сделать это только в группе')
    }
    if(!settings.allowKickme) {
        const sent = await bot.sendMessage(chatId, 'Мне запретили выгонять людей из этого чата по их желанию. Давайте попробуем решить всё мирно? Если совсем никак, то выйдите из чата сами((', { reply_to_message_id: msg.message_id})
        return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
    }
    const admins = await bot.getChatAdministrators(chatId);
    const userId = msg.from.id;
    const isAdmin = admins.some(admin => admin.user.id === userId);    
        if(isAdmin) {
            const sent = await bot.sendMessage(chatId, 'От админства не так-то просто отделаться, страдай дальше))', { reply_to_message_id: msg.message_id})
            return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
        } else {
            try {                 
                bot.banChatMember(chatId, msg.from.id)
                const sent = await bot.sendMessage(chatId, 'Пока-пока((', { reply_to_message_id: msg.message_id})
                await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                bot.unbanChatMember(chatId, msg.from.id)            
            } catch(e) {
                console.error(e)
                bot.sendMessage(chatId, 'Простите, я не смогла этого сделать. Я правда пыталась, но что-то пошло не так((', { reply_to_message_id: msg.message_id})
                return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
            }
        }
        
    
});
bot.onText(/\/ban(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const adminId = msg.from.id;
    if(msg.chat.type === 'private' || msg.chat.type === 'channel') {
        return bot.sendMessage(chatId, 'Я могу сделать это только в группе')
    }
    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some(a => a.user.id === adminId);
    const settings = getChatSettings(chatId);
    if(lastcommand >= settings.commandCd || isAdmin) {        
        lastcommand = 0
            try {
                

                if (!isAdmin) {
                    const sent = await bot.sendMessage(chatId, 'Похоже вы не обладаете правами администратора в этой группе', {
                        reply_to_message_id: msg.message_id
                    });
                    return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                }

                let args = (match[1] || '').trim().split(/\s+/).filter(Boolean);

                let targetId = null;
                let duration = null;
                let reason = '';
                let deleteFlag = false;
                let userReply = false;

                
                if (msg.reply_to_message) {
                    targetId = msg.reply_to_message.from.id;
                    userReply = true;
                } else if (args.length) {
                    const entityMention = getUserFromEntities(msg);
                    let input = entityMention || args[0];

                    const res = await ResolveUser(bot, chatId, input);
                    if (!res.ok) {
                        const sent = await bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                            reply_to_message_id: msg.message_id
                        });
                        return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                    }

                    targetId = res.id;
                    args.shift();
                }

                if (!targetId) {
                    const sent = await bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                        reply_to_message_id: msg.message_id
                    });
                    return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                }

                
                if (userReply && args.includes('-d')) {
                    deleteFlag = true;
                    args = args.filter(a => a !== '-d');
                }

                
                if (args.length && ParseDuration(args[0])) {
                    duration = ParseDuration(args[0]);
                    args.shift();
                }

                reason = args.join(' ');

                
                const isTargetAdmin = admins.some(a => a.user.id === targetId);
                if (isTargetAdmin) {
                    const sent = await bot.sendMessage(chatId, 'Я не могу наказать другого администратора', {
                        reply_to_message_id: msg.message_id
                    });
                    return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                }

                
                let untilDate = 0;
                if (duration) {
                    untilDate = Math.floor(Date.now() / 1000) + duration;
                }

                await bot.banChatMember(chatId, targetId, {
                    until_date: untilDate
                });

                
                if (deleteFlag && msg.reply_to_message) {
                    try {
                        await bot.deleteMessage(chatId, msg.reply_to_message.message_id);
                    } catch {}
                }

                const member = await bot.getChatMember(chatId, targetId).catch(() => null);
                const name = member?.user?.first_name || 'User';
                const mention = `<a href="tg://user?id=${targetId}">${name}</a>`;

                let text = `Я заблокировала ${mention}`;

                if (duration) {
                    text += ` на ${formatDuration(duration)}`;
                } else {
                    text += ` навсегда`;
                }

                if (reason) text += `\nПо причине: ${reason}`;

                const sent = await bot.sendMessage(chatId, text, {
                    parse_mode: 'HTML',
                    reply_to_message_id: msg.message_id
                });
                await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                
                const logs = loadLogs(chatId);
                const userLog = getUser(logs, targetId);

                userLog.totalPunishments++;

                const banEntry = {
                    type: 'ban',
                    active: true,
                    issuedAt: new Date().toISOString(),
                    messageText: msg.reply_to_message ? msg.reply_to_message.text || null : null,
                    messageId: msg.reply_to_message ? msg.reply_to_message.message_id : null,
                    reason,
                    adminId,
                    expiresAt: duration ? new Date(Date.now() + duration * 1000).toISOString() : null,
                    removedAt: null,
                    removedBy: null
                };
                if (!userLog.bans) userLog.bans = [];
                userLog.bans.push(banEntry);
                saveLogs(chatId, logs);

                
                const ulogs = loadUserLogs(targetId);
                const u = getUserGlobal(ulogs, targetId);

                u.totalPunishments++;

                u.bans.push({
                    ...banEntry,
                    chatId
                });

                saveUserLogs(targetId, ulogs);

            } catch (e) {
                console.error(e);
                bot.sendMessage(chatId, 'Простите, я не смогла заблокировать этого пользователя. Я правда старалась, но что-то пошло не так((', {
                    reply_to_message_id: msg.message_id
                });
                return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
            }
        }
          
    
});
bot.onText(/\/unban(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const adminId = msg.from.id;
    if(msg.chat.type === 'private' || msg.chat.type === 'channel') {
        return bot.sendMessage(chatId, 'Я могу сделать это только в группе')
    }
    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some(a => a.user.id === adminId);
    const settings = getChatSettings(chatId);
    if(lastcommand >= settings.commandCd || isAdmin) {
        try {        
            if (!isAdmin) {
                const sent = await bot.sendMessage(chatId, 'Похоже вы не обладаете правами администратора в этой группе', {
                    reply_to_message_id: msg.message_id
                });
                return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
            }

            let targetId = null;

            if (msg.reply_to_message) {
                targetId = msg.reply_to_message.from.id;
            } else {
                let args = (match[1] || '').trim().split(/\s+/).filter(Boolean);

                if (!args.length) {
                    const sent = await bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                        reply_to_message_id: msg.message_id
                    });
                    return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                }

                const entityMention = getUserFromEntities(msg);
                let input = entityMention || args[0];

                const res = await ResolveUser(bot, chatId, input);

                if (!res.ok) {
                    const sent = await bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                        reply_to_message_id: msg.message_id
                    });
                    return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                }

                targetId = res.id;
            }

            await bot.unbanChatMember(chatId, targetId);

            const member = await bot.getChatMember(chatId, targetId).catch(() => null);
            const name = member?.user?.first_name || 'User';
            const mention = `<a href="tg://user?id=${targetId}">${name}</a>`;

            const sent = await bot.sendMessage(chatId,
                `Пользователь ${mention} разблокирован. С возвращением!`,
                {
                    parse_mode: 'HTML',
                    reply_to_message_id: msg.message_id
                }
            );
            await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);

            const logs = loadLogs(chatId);
            const userLog = getUser(logs, targetId);

            if (!userLog.bans) userLog.bans = [];

            const activeBan = [...userLog.bans].reverse().find(b => b.active);

            if (activeBan) {
                activeBan.active = false;
                activeBan.removedAt = new Date().toISOString();
                activeBan.removedBy = adminId;
            }

            saveLogs(chatId, logs);


            const ulogs = loadUserLogs(targetId);
            const u = getUserGlobal(ulogs, targetId);

            if (!u.bans) u.bans = [];

            const globalBan = [...u.bans].reverse().find(b =>
                b.active && b.chatId == chatId
            );

            if (globalBan) {
                globalBan.active = false;
                globalBan.removedAt = new Date().toISOString();
                globalBan.removedBy = adminId;
            }

            saveUserLogs(targetId, ulogs);

        } catch (err) {
            console.error(err);
            return bot.sendMessage(chatId, 'Простите, я не смогла разблокировать пользователя. Я правда пыталась, но что-то пошло не так((', {
                reply_to_message_id: msg.message_id
            });
        }
        lastcommand = 0;
    }
    
});

bot.onText(/\/note(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const adminId = msg.from.id;
    if(msg.chat.type === 'private' || msg.chat.type === 'channel') {
        return bot.sendMessage(chatId, 'Я могу сделать это только в группе')
    }
    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some(a => a.user.id === adminId);
    const settings = getChatSettings(chatId);
    if(lastcommand >= settings.commandCd || isAdmin) {        
        try {            
            if (!isAdmin) {
                const sent = await bot.sendMessage(chatId, 'Похоже вы не обадаете правми администратора в этой группе', { reply_to_message_id: msg.message_id});
                return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
            }

            let args = (match[1] || '').trim().split(/\s+/);
            let targetId = null;
            let text = '';

            if (msg.reply_to_message) {
                    targetId = msg.reply_to_message.from.id;
                    userReply = true;
                    text = args.join(' ');
                } else if (args.length) {
                    const entityMention = getUserFromEntities(msg);
                    let input = entityMention || args[0];

                    const res = await ResolveUser(bot, chatId, input);
                    if (!res.ok) {
                        const sent = await bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                            reply_to_message_id: msg.message_id
                        });
                        return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                    }

                    targetId = res.id;
                    args.shift();
                    text = args.join(' ');
                }
            if (!text) {
                const sent = await bot.sendMessage(chatId, 'Вы не сказали что мне следует записать о пользователе', { reply_to_message_id: msg.message_id});
                return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
            }

            const logs = loadLogs(chatId);
            const userLog = getUser(logs, targetId);

            userLog.notes.push({
                active: true,
                text: text,
                issuedAt: new Date().toISOString(),
                adminId: adminId,
                removedAt: null,
                removedBy: null
            });

            saveLogs(chatId, logs);
            const ulogs = loadUserLogs(targetId);
            const u = getUserGlobal(ulogs, targetId);

            u.notes.push({
                active: true,
                text,
                issuedAt: new Date().toISOString(),
                adminId: msg.from.id,
                chatId: chatId,
                removedAt: null,
                removedBy: null
            });

            saveUserLogs(targetId, ulogs);

            const sent = await bot.sendMessage(chatId, 'Я всё записала!', {
                reply_to_message_id: msg.message_id
            });
            await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
        } catch (e) {
            console.error(e, '4');
            bot.sendMessage(chatId, 'Простите, я не смогла записать информацию о пользователе. Я правда пыталась, но что-то пошло не так((', { reply_to_message_id: msg.message_id})
            return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
        }
        lastcommand = 0;
    }
    
});
bot.onText(/\/unnote (\d+)(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const adminId = msg.from.id;
    const index = parseInt(match[1]) - 1;
    if(msg.chat.type === 'private' || msg.chat.type === 'channel') {
        return bot.sendMessage(chatId, 'Я могу сделать это только в группе')
    }
    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some(a => a.user.id === adminId);
    const settings = getChatSettings(chatId);
    if(lastcommand >= settings.commandCd || isAdmin) {
        try {
            if(!isAdmin) {
                const sent = await bot.sendMessage(chatId, 'Похоже вы не обладаете правами администратора в этой группе', {reply_to_message_id: msg.message_id})
                return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
            }
            
            let targetId = null;
            let args = (match[1] || '').trim().split(/\s+/);
            if (msg.reply_to_message) {
                    targetId = msg.reply_to_message.from.id;
                    userReply = true;
                } else if (args.length) {
                    const entityMention = getUserFromEntities(msg);
                    let input = entityMention || args[0];

                    const res = await ResolveUser(bot, chatId, input);
                    if (!res.ok) {
                        const sent = await bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                            reply_to_message_id: msg.message_id
                        });
                        return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                    }

                    targetId = res.id;
                    args.shift();
                }


            if (!targetId) {
                const sent = await bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', { reply_to_message_id: msg.message_id});
                return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
            } 

            const logs = loadLogs(chatId);
            const user = getUser(logs, targetId);
            

            if (isNaN(index) || index < 0) {
                const sent = await bot.sendMessage(chatId, 'Я не смогла найти такую заметку у этого пользователя. Я проверила несколько раз, но такой заметки у него точно-точно нет', {
                    reply_to_message_id: msg.message_id
                });
                return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
            }
            if (!user.notes[index]) {
                const sent = await bot.sendMessage(chatId, 'Я не смогла найти такую заметку у этого пользователя. Я проверила несколько раз, но такой заметки у него точно-точно нет', { reply_to_message_id: msg.message_id});
                return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
            }
                

            const note = user.notes[index];
            note.active = false;
            note.removedAt = new Date().toISOString();
            note.removedBy = adminId;

            saveLogs(chatId, logs);

            const ulogs = loadUserLogs(targetId);
            const u = getUserGlobal(ulogs, targetId);

            const globalNote = [...u.notes]
                .reverse()
                .find(n =>
                    n.chatId === chatId &&
                    n.text === note.text &&
                    n.active
                );

            if (globalNote) {
                globalNote.active = false;
                globalNote.removedAt = new Date().toISOString();
                globalNote.removedBy = adminId;
            }

            saveUserLogs(targetId, ulogs);
            
            const sent = await bot.sendMessage(chatId, 'Я стёрла эту заметку', { reply_to_message_id: msg.message_id});
            await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
        } catch (e) {
            console.error(e, '5');
            bot.sendMessage(chatId, 'Простите, я не смогла стереть эту заметку у пользователя. Я правда пыталась, но что-то пошло не так((', { reply_to_message_id: msg.message_id})
            return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
        }
        lastcommand = 0;
    }
    
});
bot.onText(/\/user(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const requesterId = msg.from.id;
    if(msg.chat.type === 'private' || msg.chat.type === 'channel') {
        return bot.sendMessage(chatId, 'Я могу сделать это только в группе')
    }
    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some(a => a.user.id === requesterId);
    const settings = getChatSettings(chatId);
    if(lastcommand >= settings.commandCd || isAdmin) {
        lastcommand = 0
        try {            
            let args = (match[1] || '').trim().split(/\s+/).filter(Boolean);

            let showFull = args.includes('-f');
            args = args.filter(a => a !== '-f');

            let sendToModChat = args.includes('-mc');
            args = args.filter(a => a !== '-mc');

            let targetId = requesterId;

            

            if (msg.reply_to_message) {
                    targetId = msg.reply_to_message.from.id;
                    userReply = true;
                } else if (args.length) {
                    const entityMention = getUserFromEntities(msg);
                    let input = entityMention || args[0];

                    const res = await ResolveUser(bot, chatId, input);
                    if (!res.ok) {
                        const sent = await bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                            reply_to_message_id: msg.message_id
                        });
                        return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                    }

                    targetId = res.id;
                    args.shift();
                }


            
            if (!isAdmin) {
                targetId = requesterId;
                showFull = false;
                sendToModChat = false;
            }

            const logs = loadLogs(chatId);
            const user = getUser(logs, targetId);

            const member = await bot.getChatMember(chatId, targetId).catch(() => null);

            const name = member?.user?.first_name || 'Unknown';
            const mention = `<a href="tg://user?id=${targetId}">${name}</a>`;

            let text = '';
            if(sendToModChat){
                text += `Информация отправлена в модераторский чат \n`
            }
            text += `<b>Пользователь:</b> ${mention}\n\n`;

            

            let mutes = user.mutes || [];
            if (!showFull) mutes = mutes.filter(m => m.active);

            text += `<b>Муты (${mutes.length}):</b>\n`;

            for (const m of mutes) {
                text += `\n• Статус: ${m.active ? 'активен' : 'снят'}\n`;
                text += `• Дата выдачи: ${formatDateMSK(m.issuedAt)}\n`;

                if (m.reason) {
                    text += `• Причина: ${m.reason}\n`;
                }

                if (m.messageText) {
                    text += `• Сообщение: "${m.messageText}"\n`;
                }

                if (m.expiresAt) {
                    text += `• Истекает: ${formatDateMSK(m.expiresAt)}\n`;
                }

                
                if (showFull) {
                    const admin = await getUserMention(chatId, m.adminId);
                    text += `• Выдавший админ: ${admin}\n`;

                    if (!m.active) {
                        const removedBy = await getUserMention(chatId, m.removedBy);
                        text += `• Дата снятия: ${formatDateMSK(m.removedAt)}\n`;
                        text += `• Снявший админ: ${removedBy}\n`;
                    }
                }
            }

            if (mutes.length === 0) {
                text += `нет данных\n`;
            }

            

            let notes = user.notes || [];
            if (!showFull) notes = notes.filter(n => n.active);

            text += `\n<b>Заметки (${notes.length}):</b>\n`;

            for (const n of notes) {
            const realIndex = user.notes.indexOf(n) + 1;

            text += `\n<b>#${realIndex}</b>\n`;
            text += `• Статус: ${n.active ? 'активна' : 'удалена'}\n`;
            text += `• Текст заметки: ${n.text}\n`;
            text += `• Дата выдачи: ${formatDateMSK(n.issuedAt)}\n`;

            if (showFull) {
                let adminText = n.adminId === 'system'
                    ? 'system'
                    : await getUserMention(chatId, n.adminId);

                text += `• Выдавший админ: ${adminText}\n`;

                if (!n.active) {
                    let removedByText = n.removedBy === 'system'
                        ? 'system'
                        : await getUserMention(chatId, n.removedBy);

                    text += `• Дата удаления: ${formatDateMSK(n.removedAt)}\n`;
                    text += `• Удаливший админ: ${removedByText}\n`;
                }
            }
        }

            if (notes.length === 0) {
                text += `нет данных\n`;
            }
            let warns = user.warns || [];
            if (!showFull) warns = warns.filter(w => w.active);

            text += `\n<b>Предупреждения (${warns.length}):</b>\n`;

            for (const w of warns) {

                const realIndex = user.warns.indexOf(w) + 1;

                text += `\n<b>#${realIndex}</b>\n`;
                text += `• Статус: ${w.active ? 'активно' : 'снято'}\n`;
                text += `• Дата выдачи: ${formatDateMSK(w.issuedAt)}\n`;

                if (w.reason) {
                    text += `• Причина: ${w.reason}\n`;
                }

                if (w.permanent) {
                    text += `• Постоянное: да\n`;
                }

                if (showFull) {

                    let adminText;

                    if (w.adminId === 'system') {
                        adminText = 'system';
                    } else {
                        adminText = await getUserMention(chatId, w.adminId);
                    }

                    text += `• Выдавший админ: ${adminText}\n`;

                    if (!w.active) {

                        let removedByText;

                        if (w.removedBy === 'system') {
                            removedByText = 'system';
                        } else {
                            removedByText = await getUserMention(
                                chatId,
                                w.removedBy
                            );
                        }

                        text += `• Дата снятия: ${formatDateMSK(w.removedAt)}\n`;
                        text += `• Снявший админ: ${removedByText}\n`;
                    }
                }
            }

            if (warns.length === 0) {
                text += `нет данных\n`;
            }
            let bans = user.bans || [];
            if (!showFull) bans = bans.filter(b => b.active);

            text += `\n<b>Баны (${bans.length}):</b>\n`;

            for (const b of bans) {
                text += `\n• Статус: ${b.active ? 'активен' : 'снят'}\n`;
                text += `• Дата выдачи: ${formatDateMSK(b.issuedAt)}\n`;

                if (b.reason) {
                    text += `• Причина: ${b.reason}\n`;
                }

                if (b.messageText) {
                    text += `• Сообщение: "${b.messageText}"\n`;
                }

                if (b.expiresAt) {
                    text += `• Истекает: ${formatDateMSK(b.expiresAt)}\n`;
                }

                if (showFull) {
                    const admin = await getUserMention(chatId, b.adminId);
                    text += `• Выдавший админ: ${admin}\n`;

                    if (!b.active) {
                        const removedBy = await getUserMention(chatId, b.removedBy);
                        text += `• Дата снятия: ${formatDateMSK(b.removedAt)}\n`;
                        text += `• Снявший админ: ${removedBy}\n`;
                    }
                }
            }

            if (bans.length === 0) {
                text += `нет данных\n`;
            }
            if (sendToModChat) {
                const settings = getChatSettings(chatId);
                if (!settings.modchatID) {
                    const sent = await bot.sendMessage(chatId, 'Чат модерации не настроен', { reply_to_message_id: msg.message_id });
                    return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
                }
                
                try {
                    await bot.sendMessage(settings.modchatID, text, {
                        parse_mode: 'HTML',
                        disable_web_page_preview: true
                    });
                    return bot.sendMessage(chatId, 'Я отправила информацию о пользователе в чат модерации', { 
                        reply_to_message_id: msg.message_id 
                    });
                } catch (e) {
                    console.error('Send to modchat error:', e);
                    return bot.sendMessage(chatId, 'Я не смогла отправить информацию в чат модерации. Проверьте, что я добавлена туда и у меня есть права отправлять сообщения, либо используйте команду без флага -mc', { 
                        reply_to_message_id: msg.message_id 
                    });
                }
            }

            return bot.sendMessage(chatId, text, {
                parse_mode: 'HTML',
                reply_to_message_id: msg.message_id,
                disable_web_page_preview: true
            });

        } catch (err) {
            console.error(err, '6');
            bot.sendMessage(chatId, 'Простите, я не смогла получить данные о пользователе. Я правда пыталась, но что-то пошло не так((', { reply_to_message_id: msg.message_id});
            return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
        }
    }
    
});
bot.onText(/^\/RaidMode/i, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if(msg.chat.type === 'private' || msg.chat.type === 'channel') {
        return bot.sendMessage(chatId, 'Я могу сделать это только в группе')
    }
    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some(a => a.user.id === userId);
    const settings = getChatSettings(chatId);
    if(lastcommand >= settings.commandCd || isAdmin) {
        lastcommand = 0
        if (!isAdmin) {
            return bot.sendMessage(chatId,
                'Похоже вы не обладаете правами администратора в этой группе',
                { reply_to_message_id: msg.message_id }
            );
        }

        await enableRaidMode(chatId);
    }
    lastcommand = 0;
});
bot.onText(/^\/unRaidMode/i, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if(msg.chat.type === 'private' || msg.chat.type === 'channel') {
        return bot.sendMessage(chatId, 'Я могу сделать это только в группе')
    }
    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some(a => a.user.id === userId);    
    const settings = getChatSettings(chatId);
    if(lastcommand >= settings.commandCd || isAdmin) {
        lastcommand = 0
        if (!isAdmin) {
        return bot.sendMessage(chatId,
            'Похоже вы не обладаете правами администратора в этой группе',
            { reply_to_message_id: msg.message_id }
        );
    }

    await disableRaidMode(chatId);
    }
    
});
bot.onText(/\/warn(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const adminId = msg.from.id;

    if (msg.chat.type === 'private' || msg.chat.type === 'channel') {
        return bot.sendMessage(chatId, 'Я могу сделать это только в группе');
    }

    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some(a => a.user.id === adminId);
    const settings = getChatSettings(chatId);
    if (!(lastcommand >= settings.commandCd || isAdmin)) return;

    lastcommand = 0;

    try {

        if (!isAdmin) {
            const sent = await bot.sendMessage(chatId,
                'Похоже вы не обладаете правами администратора в этой группе',
                { reply_to_message_id: msg.message_id }
            );
            return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
        }

        let args = (match[1] || '').trim().split(/\s+/).filter(Boolean);

        let targetId = null;
        let reason = '';
        let deleteFlag = false;
        let ignoreExpire = false;

        if (msg.reply_to_message) {
            targetId = msg.reply_to_message.from.id;
        } else if (args.length) {

            const entityMention = getUserFromEntities(msg);
            let input = entityMention || args[0];

            const res = await ResolveUser(bot, chatId, input);

            if (!res.ok) {
                const sent = await bot.sendMessage(chatId,
                    'Кажется я не знакома с этим пользователем',
                    { reply_to_message_id: msg.message_id }
                );
                return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
            }

            targetId = res.id;
            args.shift();
        }

        if (!targetId) {
            const sent = await bot.sendMessage(chatId,
                'Кажется я не знакома с этим пользователем',
                { reply_to_message_id: msg.message_id }
            );
            return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
        }

        if (args.includes('-d')) {
            deleteFlag = true;
            args = args.filter(a => a !== '-d');
        }

        if (args.includes('-i')) {
            ignoreExpire = true;
            args = args.filter(a => a !== '-i');
        }

        reason = args.join(' ');

        const isTargetAdmin =
            admins.some(a => a.user.id === targetId);

        if (isTargetAdmin) {
            const sent = await bot.sendMessage(chatId,
                'Я не могу наказать другого администратора',
                { reply_to_message_id: msg.message_id }
            );
            return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
        }

        if (deleteFlag && msg.reply_to_message) {
            try {
                await bot.deleteMessage(
                    chatId,
                    msg.reply_to_message.message_id
                );
            } catch {}
        }

        const member =
            await bot.getChatMember(chatId, targetId);

        const mention =
            `<a href="tg://user?id=${targetId}">${member.user.first_name}</a>`;

        const sent = await bot.sendMessage(
            chatId,
            `Я выдала предупреждение пользователю ${mention}` +
            (reason ? `\nпо причине ${reason}` : ''),
            {
                parse_mode: 'HTML',
                reply_to_message_id: msg.message_id
            }
        );
        await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
        const warnEntry = {
            active: true,
            permanent: ignoreExpire,
            issuedAt: new Date().toISOString(),
            messageText: msg.reply_to_message
                ? msg.reply_to_message.text || null
                : null,
            messageId: msg.reply_to_message
                ? msg.reply_to_message.message_id
                : null,
            reason,
            adminId,
            removedAt: null,
            removedBy: null
        };

        const logs = loadLogs(chatId);
        const userLog = getUser(logs, targetId);

        userLog.totalPunishments++;
        userLog.warns.push(warnEntry);

        saveLogs(chatId, logs);

        const ulogs = loadUserLogs(targetId);
        const u = getUserGlobal(ulogs, targetId);

        u.totalPunishments++;
        u.warns.push({
            ...warnEntry,
            chatId
        });

        saveUserLogs(targetId, ulogs);
        await checkWarnPunishment(chatId, targetId);

    } catch (e) {
        console.error(e);

        bot.sendMessage(
            chatId,
            'Простите, я не смогла выдать предупреждение этому пользователю. Я правда пыталась, но что-то пошло не так((',
            { reply_to_message_id: msg.message_id }
            
        );
        return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
    }
});
bot.onText(/\/unwarn\s+(\d+)(?:\s+(.+))?/, async (msg, match) => {

    const chatId = msg.chat.id;
    const adminId = msg.from.id;

    if (msg.chat.type === 'private' || msg.chat.type === 'channel') {
        return bot.sendMessage(chatId, 'Я могу сделать это только в группе');
    }

    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some(a => a.user.id === adminId);
    const settings = getChatSettings(chatId);
    if (!(lastcommand >= settings.commandCd || isAdmin)) return;

    lastcommand = 0;

    try {

        if (!isAdmin) {
            const sent = await bot.sendMessage(chatId,
                'Похоже вы не обладаете правами администратора в этой группе',
                { reply_to_message_id: msg.message_id }
            );
            return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
        }

        const warnIndex = parseInt(match[1]) - 1;

        let targetId = null;

        if (msg.reply_to_message) {
            targetId = msg.reply_to_message.from.id;
        } else {

            const args =
                (match[2] || '').trim().split(/\s+/).filter(Boolean);

            if (!args.length) {
                const sent = await bot.sendMessage(chatId,
                    'Кажется я не знакома с этим пользователем',
                    { reply_to_message_id: msg.message_id }
                );
                return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
            }

            const res =
                await ResolveUser(bot, chatId, args[0]);

            if (!res.ok) {
                const sent = await bot.sendMessage(chatId,
                    'Кажется я не знакома с этим пользователем',
                    { reply_to_message_id: msg.message_id }
                );
                return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
            }

            targetId = res.id;
        }

        const logs = loadLogs(chatId);
        const user = getUser(logs, targetId);

        if (!user.warns[warnIndex]) {
            const sent = await bot.sendMessage(chatId,
                'Я не смогла найти такое предупреждение',
                { reply_to_message_id: msg.message_id }
            );
            return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
        }

        const warn = user.warns[warnIndex];

        warn.active = false;
        warn.removedAt = new Date().toISOString();
        warn.removedBy = adminId;

        saveLogs(chatId, logs);

        const ulogs = loadUserLogs(targetId);
        const u = getUserGlobal(ulogs, targetId);

        const globalWarn = [...u.warns]
            .reverse()
            .find(w =>
                w.chatId == chatId &&
                w.issuedAt === warn.issuedAt &&
                w.active
            );

        if (globalWarn) {
            globalWarn.active = false;
            globalWarn.removedAt = new Date().toISOString();
            globalWarn.removedBy = adminId;
        }

        saveUserLogs(targetId, ulogs);

        const sent = await bot.sendMessage(
            chatId,
            'Я сняла это предупреждение',
            { reply_to_message_id: msg.message_id }
        );
        await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
    } catch (e) {
        console.error(e);
        bot.sendMessage(
            chatId,
            'Простите, я не смогла снять это предупреждение у пользователя. Я правда пыталась, но что-то пошло не так((',
            { reply_to_message_id: msg.message_id }
            
        );
        return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
    }
});

bot.onText(/^\/report(?:\s+(.+))?/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const settings = getChatSettings(chatId);
    try {
        
        if (!settings.modchatID) {
             const sent = await bot.sendMessage(
                chatId,
                'Чат модерации не настроен, либо вы меня в него не позвали',
                { reply_to_message_id: msg.message_id }
            );
            return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
        }

        if (!msg.reply_to_message) {
            const sent = await bot.sendMessage(
                chatId,
                'Используйте команду ответом на сообщение нарушителя',
                { reply_to_message_id: msg.message_id }
            );
            return await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
        }
        
        const reporter = msg.from;
        const offender = msg.reply_to_message.from;
        

        let reason = (match[1] || '').trim();
        const reportLog = {
        createdAt: new Date().toISOString(),
        sourceChatId: chatId,
        reporterId: reporter.id,
        reporterName: reporter.first_name,

        offenderId: offender.id,
        offenderName: offender.first_name,

        reason: reason || null,

        messageText:
            msg.reply_to_message.text ||
            msg.reply_to_message.caption ||
            null,

        messageId: msg.reply_to_message.message_id,

        reportMessageId: null,
        checked: false,
        checkedAt: null,
        checkedBy: null
    };

        let offenderText = msg.reply_to_message.text ||
                           msg.reply_to_message.caption ||
                           '[медиа-сообщение]';

        if (offenderText.length > 700) {
            offenderText = offenderText.substring(0, 700) + '...';
        }

        let messageLink = 'Сообщение недоступно';

        try {

            if (String(chatId).startsWith('-100')) {

                const internalId = String(chatId).replace('-100', '');

                messageLink =
                    `https://t.me/c/${internalId}/${msg.reply_to_message.message_id}`;
            }

        } catch {}

        const reportText =
            `<b>• Получен репорт</b>\n\n` +

            `<b>• Отправил репорт:</b>\n` +
            `<a href="tg://user?id=${reporter.id}">${reporter.first_name}</a>\n` +
            `ID: <code>${reporter.id}</code>\n\n` +

            `<b>• На пользователя:</b>\n` +
            `<a href="tg://user?id=${offender.id}">${offender.first_name}</a>\n` +
            `ID: <code>${offender.id}</code>\n\n` +

            (reason
                ? `<b>• Причина:</b>\n${reason}\n\n`
                : '') +

            `<b>• Сообщение нарушителя:</b>\n` +
            `<a href="${messageLink}">${offenderText}</a>`;

        const keyboard = {
        inline_keyboard: [
            [
                { text: 'Предупреждение', callback_data: 'report_warn' },
                { text: `Мут ${settings.quickMuteDuration}`, callback_data: 'report_mute' },
                { text: 'Бан', callback_data: 'report_ban' }
            ],
            [
                { text: 'Отклонить', callback_data: 'report_reject' },
                { text: 'Отметить как проверенный', callback_data: 'report_done' }
            ]
        ]
    };

    const sent = await bot.sendMessage(
        
        settings.modchatID,
        reportText,
        {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: keyboard
        }
    );
    reportLog.reportMessageId = sent.message_id;

    
    reportStates[sent.message_id] = {};
    

        reportLog.reportMessageId = sent.message_id;
        const chatLogs = loadLogs(chatId);

        if (!chatLogs._reports) {
            chatLogs._reports = [];
        }
        const reporterLogs = loadUserLogs(reporter.id);
        const reporterUser = getUserGlobal(reporterLogs, reporter.id);

        reporterUser.reportsSent.push({
            ...reportLog,
            chatId
        });

        saveUserLogs(reporter.id, reporterLogs);

        chatLogs._reports.push(reportLog);

        saveLogs(chatId, chatLogs);

        const offenderLogs = loadUserLogs(offender.id);
        const offenderUser = getUserGlobal(offenderLogs, offender.id);

        offenderUser.reportsReceived.push({
            ...reportLog,
            chatId
        });

        saveUserLogs(offender.id, offenderLogs);

        

        await bot.sendMessage(
            chatId,
            'Я сообщила модерации о нарушителе',
            { reply_to_message_id: msg.message_id }
        );

    } catch (e) {
        console.error('REPORT ERROR:', e);

        bot.sendMessage(
            chatId,
            'Простите, я не смогла оповестить модерацию о нарушителе. Я правла пыталась, но что-то пошло не так((',
            { reply_to_message_id: msg.message_id }
        );
        return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
    }
});
bot.onText(/^\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    
    if (msg.chat.type !== 'private') {
        return bot.sendMessage(chatId, 'Для создания обращения напишите /help мне в личные сообщения', {
            reply_to_message_id: msg.message_id
        });
    }

    
    const tickets = loadTickets();
    const userTicket = Object.values(tickets).find(t => t.userId === userId && t.status === 'open');
    if (userTicket) {
        return bot.sendMessage(chatId, `У вас уже есть открытый тикет #${userTicket.ticketNumber}. Закройте его перед созданием нового.`);
    }

    
    ticketCreationStates[userId] = { step: 'awaiting_topic' };
    bot.sendMessage(chatId, 'Пожалуйста, отправьте тему запроса (не более 100 символов).');
});
bot.onText(/\/tickets/, async (msg) => {
    const chatId = msg.chat.id;
    if (msg.chat.type !== 'private') return; 

    const userId = msg.from.id;
    const tickets = loadTickets();
    const openTickets = Object.values(tickets).filter(t => t.userId === userId && t.status === 'open');

    if (openTickets.length === 0) {
        return bot.sendMessage(chatId, 'У вас нет открытых тикетов.');
    }

    let text = 'Ваши открытые тикеты:\n';
    for (const t of openTickets) {
        text += `\n#${t.ticketNumber} — ${t.topic} (создан ${new Date(t.createdAt).toLocaleString()})`;
    }
    bot.sendMessage(chatId, text);
});
bot.onText(/\/close/, async (msg) => {
    const chatId = msg.chat.id;

    if (chatId !== parseInt(supportChat) || !msg.message_thread_id) {
        return;
    }

    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some(a => a.user.id === msg.from.id);
    if (!isAdmin) {
        return bot.sendMessage(chatId, 'Только операторы поддержки могут закрыть тикет командой. Для закрытия тикета воспользуйтесь одноимённой кнопкой под сообщением о созданном тикете.', {
            message_thread_id: msg.message_thread_id
        });
    }

    const tickets = loadTickets();
    const ticket = Object.values(tickets).find(t => t.topicId === msg.message_thread_id && t.status === 'open');
    if (!ticket) {
        return bot.sendMessage(chatId, 'Тикет не найден или уже закрыт.', {
            message_thread_id: msg.message_thread_id
        });
    }

    if (confirmCloseStates[msg.from.id]) {
        return bot.sendMessage(chatId, 'У вас уже есть активный запрос на закрытие. Подтвердите его или подождите 20 секунд.', {
            message_thread_id: msg.message_thread_id
        });
    }

    const code = Math.floor(1000 + Math.random() * 9000);
    confirmCloseStates[msg.from.id] = { code, timer: null, ticketNumber: ticket.ticketNumber };

    const confirmMsg = await bot.sendMessage(chatId,
        `Для подтверждения закрытия тикета #${ticket.ticketNumber} отправьте сообщение с кодом: ЗАКРЫТЬ ${code}. У вас 20 секунд.`,
        { message_thread_id: msg.message_thread_id }
    );

    const timer = setTimeout(async () => {
        delete confirmCloseStates[msg.from.id];
        try {
            await bot.editMessageText('Время вышло. Закрытие отменено.', {
                chat_id: chatId,
                message_id: confirmMsg.message_id,
                message_thread_id: msg.message_thread_id
            });
        } catch (e) {}
    }, 20000);
    confirmCloseStates[msg.from.id].timer = timer;
});
bot.onText(/^\/settings(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (msg.chat.type === 'private' || msg.chat.type === 'channel') {
        return bot.sendMessage(chatId, 'Я могу сделать это только в группе');
    }

    try {
        const admins = await bot.getChatAdministrators(chatId);
        const isAdmin = admins.some(a => a.user.id === userId);

        if (!isAdmin) {
            return bot.sendMessage(chatId, 'Похоже вы не обладаете правами администратора в этом чате', {
                reply_to_message_id: msg.message_id
            });
        }

        const sent = await showSettingsMenu(chatId);
        
        if (!settingsInputStates[chatId]) {
            settingsInputStates[chatId] = {};
        }
        settingsInputStates[chatId].menuMessageId = sent.message_id;
        settingsInputStates[chatId].currentPage = 0;

    } catch (e) {
        console.error('Settings error:', e);
        bot.sendMessage(chatId, 'Простите, я не смогла открыть настройки. Я правда пыталась, но что-то пошло не так((', {
            reply_to_message_id: msg.message_id
        });
        return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
    }
});
bot.onText(/^\/секретнаякоманда/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;    
        const sent = await bot.sendMessage(chatId, 'Поздравляю! Вы нашли секретную команду', {
            reply_to_message_id: msg.message_id
        });
        bot.sendSticker(chatId, 'CAACAgIAAxkBAAEFGRxqSqEm2uB_teXD0QtTAii1S_rkAwACHlQAAv66sUmbwZ-omCYB-jwE', { reply_to_message_id: msg.message_id})
        await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
    
});
bot.onText(/^\/дофигасекретнаякоманда/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;    
        const sent = await bot.sendMessage(chatId, 'Поздравляю! Вы нашли дофига секретную команду', {
            reply_to_message_id: msg.message_id
        });
        bot.sendSticker(chatId, 'CAACAgIAAxkBAAEFGRhqSqD0VJfrqNllJjkc-7kCI5O62gACDE8AAt0GEUqlsomqdO_jSDwE', { reply_to_message_id: msg.message_id})
        await deleteCommandAndResponse(chatId, msg.message_id, sent.message_id);
});
bot.onText(/^!ойчто/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (msg.chat.type === 'private' || msg.chat.type === 'channel') return;
    
    try {
        const admins = await bot.getChatAdministrators(chatId);
        const isAdmin = admins.some(a => a.user.id === userId);
        
        if (isAdmin) return;
        
        const untilDate = Math.floor(Date.now() / 1000) + 5;
        
        await bot.restrictChatMember(chatId, userId, {
            permissions: {
                can_send_messages: false,
                can_send_media_messages: false,
                can_send_polls: false,
                can_send_other_messages: false,
                can_add_web_page_previews: false,
                can_react_to_messages: false
            },
            until_date: untilDate
        });
        
        setTimeout(async () => {
            try {
                await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
            } catch (e) {}
        }, 1000);
        
        setTimeout(async () => {
            try {
                await bot.restrictChatMember(chatId, userId, {
                    can_send_messages: true,
                    can_send_media_messages: true,
                    can_send_polls: true,
                    can_send_other_messages: true,
                    can_add_web_page_previews: true,
                    can_react_to_messages: true
                });
            } catch (e) {}
        }, 5000);
        
    } catch (error) {
        console.error('!ой ошибка:', error);
    }
});


bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (msg.chat.type !== 'private') return;
    

    
    if (ticketCreationStates[userId]) {
        const state = ticketCreationStates[userId];
        if (state.step === 'awaiting_topic') {
            const topic = msg.text?.trim();
            if (!topic || topic.length > 100) {
                return bot.sendMessage(chatId, 'Тема должна быть не более 100 символов. Попробуйте ещё раз.');
            }
            state.topic = topic;
            state.step = 'awaiting_description';
            return bot.sendMessage(chatId, 'Теперь опишите проблему подробно (не более 800 символов).\n\n Не прикрепляйте медиафайлы, вы сможете сделать это позже при помощи кнопки "отправить дополнительно" ');
        }

        if (state.step === 'awaiting_description') {
            
            let description = msg.text?.trim() || '';
            if (description.length > 800) {
                return bot.sendMessage(chatId, 'Описание не должно превышать 800 символов. Попробуйте короче.');
            }

            
            const media = [];
            if (msg.photo) {
                const largestPhoto = msg.photo[msg.photo.length - 1];
                media.push({ type: 'photo', file_id: largestPhoto.file_id });
            }
            if (msg.video) media.push({ type: 'video', file_id: msg.video.file_id });
            if (msg.document) media.push({ type: 'document', file_id: msg.document.file_id });
            if (msg.audio) media.push({ type: 'audio', file_id: msg.audio.file_id });
            if (msg.animation) media.push({ type: 'animation', file_id: msg.animation.file_id });

            
            if (media.length) {
                if (!state.media) state.media = [];
                state.media.push(...media);
                if (state.media.length > 5) {
                    return bot.sendMessage(chatId, 'Не более 5 медиафайлов. Уберите пожалуйста лишние.');
                }
            }

            
            if (description) {
                state.description = description;
                state.step = 'awaiting_urgency';
                
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: 'Максимальная', callback_data: 'urgency_high' },
                            { text: 'Умеренная', callback_data: 'urgency_medium' },
                            { text: 'Низкая', callback_data: 'urgency_low' }
                        ]
                    ]
                };
                return bot.sendMessage(chatId, 'Выберите срочность запроса:', { reply_markup: keyboard });
            } else {
                
                return bot.sendMessage(chatId, 'Пожалуйста, добавьте текстовое описание к запросу.');
            }
        }
        if (ticketCreationStates[userId] && ticketCreationStates[userId].step === 'extra_message') {
        const state = ticketCreationStates[userId];
        const ticketNumber = state.ticketNumber;
        const tickets = loadTickets();
        const ticket = tickets[ticketNumber];
        if (!ticket || ticket.status !== 'open') {
            delete ticketCreationStates[userId];
            return bot.sendMessage(chatId, 'Тикет уже закрыт.');
        }

        const description = msg.text?.trim() || '';
        if (description.length > 800) {
            return bot.sendMessage(chatId, 'Сообщение не должно превышать 800 символов.');
        }

        const media = [];
        if (msg.photo) {
            const largestPhoto = msg.photo[msg.photo.length - 1];
            media.push({ type: 'photo', file_id: largestPhoto.file_id });
        }
        if (msg.video) media.push({ type: 'video', file_id: msg.video.file_id });
        if (msg.document) media.push({ type: 'document', file_id: msg.document.file_id });
        if (msg.audio) media.push({ type: 'audio', file_id: msg.audio.file_id });
        if (msg.animation) media.push({ type: 'animation', file_id: msg.animation.file_id });
        
        if (media.length > 5) {
            return bot.sendMessage(chatId, 'Не более 5 медиафайлов.');
        }

        if (description) {
            let content = `<b>Дополнительное сообщение от пользователя:</b>\n\n${description}`;
            await bot.sendMessage(supportChat, content, {
                message_thread_id: ticket.topicId,
                parse_mode: 'HTML'
            });
        }

        if (media.length > 0) {
    for (const m of media) {
        try {
            await bot.sendMessage(supportChat, '', {
                message_thread_id: ticket.topicId,
                [m.type]: m.file_id
            });
        } catch (err) {
            console.error('Ошибка отправки медиа:', err);
            try {
                await bot.sendDocument(supportChat, m.file_id, {
                    message_thread_id: ticket.topicId,
                    caption: 'Вложение'
                });
            } catch (e2) {
                console.error('Не удалось отправить медиа:', e2);
            }
        }
    }
}

        ticket.messages.push({
            type: 'user',
            text: description,
            media,
            timestamp: new Date().toISOString()
        });
        tickets[ticketNumber] = ticket;
        saveTickets(tickets);

        delete ticketCreationStates[userId];
        bot.sendMessage(chatId, 'Ваше сообщение отправлено в поддержку.');
    }
    }

    
    if (confirmCloseStates[userId]) {
        const state = confirmCloseStates[userId];
        const expected = `ЗАКРЫТЬ ${state.code}`;
        if (msg.text === expected) {
            clearTimeout(state.timer);
            delete confirmCloseStates[userId];
            
            await closeTicket(state.ticketNumber, userId, 'user');
        } else {
            bot.sendMessage(chatId, 'Неверный код. Закрытие отменено.');
            clearTimeout(state.timer);
            delete confirmCloseStates[userId];
        }
    }
});

    


bot.on('message', async (msg) => {
    try {
        const serviceFields = [
            'left_chat_member',
            'new_chat_title',
            'new_chat_photo',
            'delete_chat_photo',
            'group_chat_created',
            'supergroup_chat_created',
            'channel_chat_created',
            'pinned_message',
            'video_chat_started',
            'video_chat_ended',
            'video_chat_participants_invited',
            'video_chat_scheduled'
        ];

        if (serviceFields.some(field => msg[field] !== undefined)) {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
        }
    } catch {}
});

bot.on('new_chat_members', async (msg) => {
    if (!msg || !msg.new_chat_members) {
        return;
    }

    const chatId = msg.chat.id;
    
    let members = [];
    try {
        if (Array.isArray(msg.new_chat_members)) {
            members = msg.new_chat_members;
        } else {
            members = Object.values(msg.new_chat_members);
        }
    } catch (e) {
        return;
    }

    if (!members || members.length === 0) {
        return;
    }

    const botId = bot.botInfo ? bot.botInfo.id : null;
    const validUsers = [];
    for (const user of members) {
        if (!user || typeof user !== 'object') continue;
        const userId = user.id || user.user_id;
        if (!userId) continue;
        if (user.is_bot === true) continue;
        if (botId && userId === botId) continue;
        validUsers.push({
            id: userId,
            first_name: user.first_name || 'Пользователь',
            username: user.username || null
        });
    }

    if (validUsers.length === 0) {
        return;
    }

    let settings;
    try {
        settings = getChatSettings(chatId);
    } catch (e) {
        return;
    }

    if (raidModeChats.has(chatId)) {
        try {
            const admins = await bot.getChatAdministrators(chatId);
            for (const user of validUsers) {
                const isAdmin = admins.some(a => a.user.id === user.id);
                if (!isAdmin) {
                    try {
                        await bot.banChatMember(chatId, user.id);
                        await bot.unbanChatMember(chatId, user.id);
                    } catch (e) {
                        console.error('Raid mode kick error:', e);
                    }
                }
            }
        } catch (e) {
            console.error('Raid mode error:', e);
        }
        return;
    }

    let raidDetected = false;
    try {
        if (settings.autoRaidMode) {
            const sensitivityMap = {                
                1: 5,   
                2: 7,   
                3: 10,  
                4: 15,  
                5: 25   
            };
            
            const raidThreshold = sensitivityMap[settings.raidSensitivity] || 10;

            if (!joinTracker[chatId]) {
                joinTracker[chatId] = [];
            }

            const now = Date.now();

            for (const user of validUsers) {
                joinTracker[chatId].push({
                    id: user.id,
                    time: now
                });
            }

            joinTracker[chatId] = joinTracker[chatId].filter(
                entry => now - entry.time <= 15000
            );

            if (joinTracker[chatId].length >= raidThreshold) {
                raidDetected = true;
                const raidUsers = [...joinTracker[chatId]];

                await enableRaidMode(chatId);

                const admins = await bot.getChatAdministrators(chatId);
                for (const entry of raidUsers) {
                    const isAdmin = admins.some(a => a.user.id === entry.id);
                    if (!isAdmin) {
                        try {
                            await bot.banChatMember(chatId, entry.id);
                            await bot.unbanChatMember(chatId, entry.id);
                        } catch (e) {
                            console.error('Raid ban error:', e);
                        }
                    }
                }

                joinTracker[chatId] = [];
            }
        }
    } catch (e) {
        console.error('Raid detector error:', e);
    }

    if (raidDetected) {
        return;
    }

    if (settings.captchaEnabled) {
        for (const user of validUsers) {
            try {
                await bot.restrictChatMember(chatId, user.id, {
                    permissions: {
                        can_send_messages: false,
                        can_send_media_messages: false,
                        can_send_polls: false,
                        can_send_other_messages: false,
                        can_add_web_page_previews: false,
                        can_react_to_messages: false
                    }
                });

                if (!captchaStates[chatId]) {
                    captchaStates[chatId] = {};
                }
                
                const captchaType = settings.captchaType || 'simple';
                
                let welcomeText = settings.welcomeMessageText || 'Добро пожаловать в чат, ?name!';
                const mention = `<a href="tg://user?id=${user.id}">${user.first_name}</a>`;
                welcomeText = welcomeText.replace(/\?name/g, mention);
                
                let keyboard;
                let captchaData = {
                    messageId: null,
                    sentAt: Date.now(),
                    type: captchaType
                };
                
                if (captchaType === 'hard') {
                    const problem = generateMathProblem();
                    captchaData.correctAnswer = problem.correctAnswer;
                    welcomeText += `\n\nРешите пример: ${problem.question}`;
                    keyboard = {
                        inline_keyboard: problem.options.map(opt => [
                            { text: String(opt), callback_data: `captcha_${user.id}_${opt}` }
                        ])
                    };
                } else {
                    welcomeText += '\n\nДля того, чтобы писать в чат, нажмите на кнопку ниже.';
                    keyboard = {
                        inline_keyboard: [
                            [{ 
                                text: 'Я человек!', 
                                callback_data: `captcha_${user.id}_verify`
                            }]
                        ]
                    };
                }
                
                captchaStates[chatId][user.id] = captchaData;

                const sentMsg = await bot.sendMessage(chatId, welcomeText, {
                    parse_mode: 'HTML',
                    reply_to_message_id: msg.message_id,
                    reply_markup: keyboard
                });

                if (captchaStates[chatId] && captchaStates[chatId][user.id]) {
                    captchaStates[chatId][user.id].messageId = sentMsg.message_id;
                }

            } catch (e) {
                console.error('Ошибка отправки капчи:', e);
            }
        }
    } else if (settings.welcomeMessageEnabled) {
        for (const user of validUsers) {
            try {
                let welcomeText = settings.welcomeMessageText || 'Добро пожаловать в чат, ?name!';
                const mention = `<a href="tg://user?id=${user.id}">${user.first_name}</a>`;
                welcomeText = welcomeText.replace(/\?name/g, mention);
                
                await bot.sendMessage(chatId, welcomeText, {
                    parse_mode: 'HTML',
                    reply_to_message_id: msg.message_id
                });
            } catch (e) {
                console.error('Ошибка отправки приветствия:', e);
            }
        }
    }
});

 
bot.on('message', async (msg) => {
    if (msg.chat.type !== 'supergroup' && msg.chat.type !== 'group') return;
    
    if (!msg.forward_from_chat || msg.forward_from_chat.type !== 'channel') return;
    
    if (msg.edit_date) return;
    
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const settings = getChatSettings(chatId);
    if (settings.autoComment && settings.autoCommentText) {
        bot.getChat(chatId)
            .then(async(chat) => {
                if (chat.linked_chat_id) {
                    if(msg.forward_from_chat.id == chat.linked_chat_id) {
                        try {
                            
                            const Dur = ParseDuration(settings.mediaRestrictionDuration)
                            if(settings.mediaRestrictionEnabled) 
                            {
                                await bot.sendMessage(chatId, settings.autoCommentText + `\n\nЯ запретила отправлть медиа-сообщения и ставить реакции на ${formatDuration(Dur)}` + settings.autoCommentTextEnd, {
                                    reply_to_message_id: messageId
                                });
                            } else {
                                await bot.sendMessage(chatId, settings.autoCommentText + settings.autoCommentTextEnd, {
                                    reply_to_message_id: messageId
                                });                            
                            }
                            
                            
                            if (settings.mediaRestrictionEnabled) {
                                try {
                                    const current = await bot.getChat(chatId);
                                    const tempMediaRestPrem = {                                        
                                        can_send_messages: true,
                                        can_send_audios: false,
                                        can_send_documents: false,
                                        can_send_photos: false,
                                        can_send_videos: false,
                                        can_send_video_notes: false,
                                        can_send_voice_notes: false,
                                        can_send_polls: false,
                                        can_send_other_messages: false,
                                        can_react_to_messages: false
                                                                                                           
                                    }
                                    await bot.setChatPermissions(chatId, tempMediaRestPrem);

                                    if (!temporaryRestrictions[chatId]) {
                                        temporaryRestrictions[chatId] = {};
                                    }

                                    temporaryRestrictions[chatId].mediaUntil =
                                        Date.now() + ParseDuration(settings.mediaRestrictionDuration) * 1000;        
                                } catch (e) {
                                    console.error("Media restriction enable error:", e);
                                }
                            }

                                

                            setInterval(async () => {
                                
                                const now = Date.now();

                                for (const chatId of Object.keys(temporaryRestrictions)) {

                                    const data = temporaryRestrictions[chatId];

                                    try {                                     
                                        if (data.mediaUntil && now >= data.mediaUntil) {

                                            await bot.setChatPermissions(chatId, {
                                                can_send_messages: true,
                                                can_send_audios: true,
                                                can_send_documents: true,
                                                can_send_photos: true,
                                                can_send_videos: true,
                                                can_send_video_notes: true,
                                                can_send_voice_notes: true,
                                                can_send_polls: true,
                                                can_send_other_messages: true,
                                                can_react_to_messages: true
                                            });

                                            delete data.mediaUntil;

                                            await bot.sendMessage(
                                                chatId,
                                                "Я разрешила отправлять медиа-сообщения и ставить реакции!",
                                                { reply_to_message_id: messageId}
                                            );
                                        }

                                        if (Object.keys(data).length === 0) {
                                            delete temporaryRestrictions[chatId];
                                        }

                                    } catch (e) {
                                        console.error("Temporary restriction error:", e);
                                    }
                                }

                            }, 10000);


                        } catch (e) {
                            console.error('Ошибка отправки авто-комментария:', e);
                        }
                    }
                
                }
            })
            .catch((err) => {
                console.error('Ошибка при получении чата:', err);
            });
        
        
    }
});

setInterval(async () => {
    try {
        const chatFiles = fs.readdirSync(CHAT_LOG_DIR);

        for (const file of chatFiles) {
            const chatId = file.replace('_logs.json', '');
            const logs = loadLogs(chatId);
            let changed = false;

            for (const userId of Object.keys(logs)) {
                const user = logs[userId];
                if (user.bans) {
                    for (const ban of user.bans) {
                        if (!ban.active || !ban.expiresAt) continue;

                        if (Date.now() >= new Date(ban.expiresAt).getTime()) {
                            ban.active = false;
                            ban.removedAt = new Date().toISOString();
                            ban.removedBy = 'system';
                            
                            const ulogs = loadUserLogs(userId);
                            const u = getUserGlobal(ulogs, userId);

                            const globalBan = u.bans.find(b =>
                                b.chatId == chatId &&
                                b.issuedAt === ban.issuedAt &&
                                b.active
                            );

                            if (globalBan) {
                                globalBan.active = false;
                                globalBan.removedAt = new Date().toISOString();
                                globalBan.removedBy = 'system';
                            }

                            saveUserLogs(userId, ulogs);
                            changed = true;
                        }
                    }
                }
                if (!user.mutes) continue;

                for (const mute of user.mutes) {
                    if (!mute.active || !mute.expiresAt) continue;

                    const expireTime = new Date(mute.expiresAt).getTime();

                    if (Date.now() >= expireTime) {
                        mute.active = false;
                        mute.removedAt = new Date().toISOString();
                        mute.removedBy = 'system';
                        changed = true;

                        
                        const ulogs = loadUserLogs(userId);
                        const u = getUserGlobal(ulogs, userId);

                        const globalMute = [...u.mutes]
                            .reverse()
                            .find(m =>
                                m.chatId == chatId &&
                                m.active &&
                                m.issuedAt === mute.issuedAt
                            );

                        if (globalMute) {
                            globalMute.active = false;
                            globalMute.removedAt = new Date().toISOString();
                            globalMute.removedBy = 'system';
                        }

                        saveUserLogs(userId, ulogs);
                    }
                }
                if (user.warns) {
                    const settings = getChatSettings(chatId);
                const warnExpireSeconds =
                    ParseDuration(settings.warnExpireTime);

                if (warnExpireSeconds > 0) {

                    for (const warn of user.warns) {

                        if (!warn.active) continue;
                        if (warn.permanent) continue;

                        const issued =
                            new Date(warn.issuedAt).getTime();

                        if (
                            Date.now() - issued >=
                            warnExpireSeconds * 1000
                        ) {

                            warn.active = false;
                            warn.removedAt =
                                new Date().toISOString();
                            warn.removedBy = 'system';

                            const ulogs =
                                loadUserLogs(userId);

                            const u =
                                getUserGlobal(ulogs, userId);

                            const globalWarn =
                                [...u.warns]
                                    .reverse()
                                    .find(w =>
                                        w.chatId == chatId &&
                                        w.active &&
                                        w.issuedAt === warn.issuedAt
                                    );

                            if (globalWarn) {
                                globalWarn.active = false;
                                globalWarn.removedAt =
                                    new Date().toISOString();
                                globalWarn.removedBy =
                                    'system';
                            }

                            saveUserLogs(userId, ulogs);

                            changed = true;
                        }
                    }
                }
            }
            }

            if (changed) {
                saveLogs(chatId, logs);
            }
        }
    } catch (e) {
        console.error('AUTO EXPIRE ERROR:', e);
    }
    
}, 30 * 1000);
async function checkWarnPunishment(chatId, targetId) {

    try {

        const logs = loadLogs(chatId);
        const user = getUser(logs, targetId);
        const settings = getChatSettings(chatId);
        const activeWarns =
            (user.warns || []).filter(w => w.active).length;

        if (activeWarns < settings.warnPunishmentCount) {
            return;
        }

        const now = new Date().toISOString();

        const punishmentDuration =
            settings.warnPunishment.duration
                ? ParseDuration(settings.warnPunishment.duration)
                : null;

        if (settings.warnPunishment.type === 'mute') {

            let untilDate = 0;

            if (punishmentDuration) {
                untilDate =
                    Math.floor(Date.now() / 1000) +
                    punishmentDuration;
            }

            await bot.restrictChatMember(chatId, targetId, {
                permissions: {
                    can_send_messages: false,
                    can_send_media_messages: false,
                    can_send_polls: false,
                    can_send_other_messages: false,
                    can_add_web_page_previews: false
                },
                until_date: untilDate
            });

            const muteLog = {
                active: true,
                issuedAt: now,
                messageText: null,
                messageId: null,
                reason: 'auto (warns)',
                adminId: 'system',
                expiresAt: punishmentDuration
                    ? new Date(
                        Date.now() +
                        punishmentDuration * 1000
                    ).toISOString()
                    : null,
                removedAt: null,
                removedBy: null
            };

            user.totalPunishments++;
            user.mutes.push(muteLog);

            saveLogs(chatId, logs);

            const ulogs = loadUserLogs(targetId);
            const u = getUserGlobal(ulogs, targetId);

            u.totalPunishments++;
            u.mutes.push({
                ...muteLog,
                chatId
            });

            saveUserLogs(targetId, ulogs);
            const member =
                await bot.getChatMember(chatId, targetId)
                    .catch(() => null);

            const name =
                member?.user?.first_name || 'Пользователь';

            const mention =
                `<a href="tg://user?id=${targetId}">${name}</a>`;

            await bot.sendMessage(
                chatId,
                `Я автоматически запретила пользователю ${mention} писать в чат за достижение лимита предупреждений (${activeWarns}/${settings.warnPunishmentCount})` +
                (punishmentDuration
                    ? `\nСрок: ${formatDuration(punishmentDuration)}`
                    : ' навсегда'),
                {
                    parse_mode: 'HTML'
                }
            );

        } else if (settings.warnPunishment.type === 'ban') {

            let untilDate = 0;

            if (punishmentDuration) {
                untilDate =
                    Math.floor(Date.now() / 1000) +
                    punishmentDuration;
            }

            await bot.banChatMember(chatId, targetId, {
                until_date: untilDate
            });

            const banLog = {
                active: true,
                issuedAt: now,
                messageText: null,
                messageId: null,
                reason: 'auto (warns)',
                adminId: 'system',
                expiresAt: punishmentDuration
                    ? new Date(
                        Date.now() +
                        punishmentDuration * 1000
                    ).toISOString()
                    : null,
                removedAt: null,
                removedBy: null
            };

            user.totalPunishments++;
            user.bans.push(banLog);

            saveLogs(chatId, logs);

            const ulogs = loadUserLogs(targetId);
            const u = getUserGlobal(ulogs, targetId);

            u.totalPunishments++;
            u.bans.push({
                ...banLog,
                chatId
            });

            saveUserLogs(targetId, ulogs);
            const member =
                await bot.getChatMember(chatId, targetId)
                    .catch(() => null);

            const name =
                member?.user?.first_name || 'Пользователь';

            const mention =
                `<a href="tg://user?id=${targetId}">${name}</a>`;

            await bot.sendMessage(
                chatId,
                `Я заблокировала в чате пользователя ${mention} за достижение лимита предупреждений (${activeWarns}/${settings.warnPunishmentCount})` +
                (punishmentDuration
                    ? `\nСрок: ${formatDuration(punishmentDuration)}`
                    : ' навсегда'),
                {
                    parse_mode: 'HTML'
                }
            );
        }

    } catch (e) {
        console.error('WARN AUTO PUNISH ERROR:', e);
    }
}

// bot.js — добавьте после функции checkWarnPunishment

// === ОБРАБОТКА ОТМЕНЫ НАКАЗАНИЙ ИЗ ПАНЕЛИ ===
async function processCancellations() {
    try {
        if (!fs.existsSync(CANCEL_FILE)) {
            return;
        }

        const raw = fs.readFileSync(CANCEL_FILE, 'utf8');
        const cancelData = JSON.parse(raw);
        
        if (!cancelData.pending || cancelData.pending.length === 0) {
            return;
        }

        let modified = false;
        const remaining = [];

        for (const item of cancelData.pending) {
            const key = `${item.chatId}_${item.userId}_${item.punishmentType}_${item.index}`;
            
            // Пропускаем уже обработанные
            if (processedCancellations.has(key)) {
                continue;
            }

            try {
                const chatId = parseInt(item.chatId);
                const userId = parseInt(item.userId);
                const adminId = item.adminId ? parseInt(item.adminId) : null;
                const punishmentType = item.punishmentType;
                const index = item.index;

                let success = false;
                let logMessage = '';

                // Загружаем логи чата
                const logFile = getChatLogFile(chatId);
                const logs = loadLogs(chatId);
                const user = getUser(logs, userId);

                // Проверяем существование наказания
                if (!user[punishmentType] || !user[punishmentType][index]) {
                    logMessage = `Наказание ${punishmentType}[${index}] для пользователя ${userId} не найдено`;
                    console.log(`[Cancel] ${logMessage}`);
                    processedCancellations.add(key);
                    continue;
                }

                const punishment = user[punishmentType][index];

                // Проверяем, активно ли наказание
                if (punishment.active === false) {
                    logMessage = `Наказание ${punishmentType}[${index}] для пользователя ${userId} уже неактивно`;
                    console.log(`[Cancel] ${logMessage}`);
                    processedCancellations.add(key);
                    continue;
                }

                // Отменяем наказание в зависимости от типа
                switch (punishmentType) {
                    case 'mutes': {
                        // Снимаем мут через unmute
                        try {
                            await bot.restrictChatMember(chatId, userId, {
                                can_send_messages: true,
                                can_send_media_messages: true,
                                can_send_polls: true,
                                can_send_other_messages: true,
                                can_add_web_page_previews: true,
                                can_react_to_messages: true
                            });

                            punishment.active = false;
                            punishment.removedAt = new Date().toISOString();
                            punishment.removedBy = adminId || 'system';
                            
                            // Обновляем глобальные логи
                            const ulogs = loadUserLogs(userId);
                            const u = getUserGlobal(ulogs, userId);
                            const globalMute = [...u.mutes].reverse().find(m => 
                                m.chatId == chatId && 
                                m.issuedAt === punishment.issuedAt && 
                                m.active
                            );
                            if (globalMute) {
                                globalMute.active = false;
                                globalMute.removedAt = new Date().toISOString();
                                globalMute.removedBy = adminId || 'system';
                            }
                            saveUserLogs(userId, ulogs);
                            
                            success = true;
                            logMessage = `Мут для пользователя ${userId} отменён${adminId ? ` администратором ${adminId}` : ''}`;
                        } catch (e) {
                            logMessage = `Ошибка отмены мута для ${userId}: ${e.message}`;
                            console.error(`[Cancel] ${logMessage}`);
                        }
                        break;
                    }

                    case 'bans': {
                        // Снимаем бан через unban
                        try {
                            await bot.unbanChatMember(chatId, userId);

                            punishment.active = false;
                            punishment.removedAt = new Date().toISOString();
                            punishment.removedBy = adminId || 'system';
                            
                            // Обновляем глобальные логи
                            const ulogs = loadUserLogs(userId);
                            const u = getUserGlobal(ulogs, userId);
                            const globalBan = [...u.bans].reverse().find(b => 
                                b.chatId == chatId && 
                                b.issuedAt === punishment.issuedAt && 
                                b.active
                            );
                            if (globalBan) {
                                globalBan.active = false;
                                globalBan.removedAt = new Date().toISOString();
                                globalBan.removedBy = adminId || 'system';
                            }
                            saveUserLogs(userId, ulogs);
                            
                            success = true;
                            logMessage = `Бан для пользователя ${userId} отменён${adminId ? ` администратором ${adminId}` : ''}`;
                        } catch (e) {
                            logMessage = `Ошибка отмены бана для ${userId}: ${e.message}`;
                            console.error(`[Cancel] ${logMessage}`);
                        }
                        break;
                    }

                    case 'warns': {
                        // Снимаем предупреждение
                        try {
                            punishment.active = false;
                            punishment.removedAt = new Date().toISOString();
                            punishment.removedBy = adminId || 'system';
                            
                            // Обновляем глобальные логи
                            const ulogs = loadUserLogs(userId);
                            const u = getUserGlobal(ulogs, userId);
                            const globalWarn = [...u.warns].reverse().find(w => 
                                w.chatId == chatId && 
                                w.issuedAt === punishment.issuedAt && 
                                w.active
                            );
                            if (globalWarn) {
                                globalWarn.active = false;
                                globalWarn.removedAt = new Date().toISOString();
                                globalWarn.removedBy = adminId || 'system';
                            }
                            saveUserLogs(userId, ulogs);
                            
                            success = true;
                            logMessage = `Предупреждение для пользователя ${userId} отменено${adminId ? ` администратором ${adminId}` : ''}`;
                        } catch (e) {
                            logMessage = `Ошибка отмены предупреждения для ${userId}: ${e.message}`;
                            console.error(`[Cancel] ${logMessage}`);
                        }
                        break;
                    }

                    case 'notes': {
                        // Удаляем заметку
                        try {
                            punishment.active = false;
                            punishment.removedAt = new Date().toISOString();
                            punishment.removedBy = adminId || 'system';
                            
                            // Обновляем глобальные логи
                            const ulogs = loadUserLogs(userId);
                            const u = getUserGlobal(ulogs, userId);
                            const globalNote = [...u.notes].reverse().find(n => 
                                n.chatId == chatId && 
                                n.text === punishment.text && 
                                n.active
                            );
                            if (globalNote) {
                                globalNote.active = false;
                                globalNote.removedAt = new Date().toISOString();
                                globalNote.removedBy = adminId || 'system';
                            }
                            saveUserLogs(userId, ulogs);
                            
                            success = true;
                            logMessage = `Заметка для пользователя ${userId} удалена${adminId ? ` администратором ${adminId}` : ''}`;
                        } catch (e) {
                            logMessage = `Ошибка удаления заметки для ${userId}: ${e.message}`;
                            console.error(`[Cancel] ${logMessage}`);
                        }
                        break;
                    }

                    default:
                        logMessage = `Неизвестный тип наказания: ${punishmentType}`;
                        console.log(`[Cancel] ${logMessage}`);
                }

                // Если успешно — сохраняем логи чата
                if (success) {
                    saveLogs(chatId, logs);
                    processedCancellations.add(key);
                    modified = true;
                    
                    // Отправляем уведомление в чат
                    try {
                        const member = await bot.getChatMember(chatId, userId);
                        const userName = member.user.first_name || 'Пользователь';
                        const mention = `<a href="tg://user?id=${userId}">${userName}</a>`;
                        const typeLabels = {
                            mutes: 'мут',
                            bans: 'бан',
                            warns: 'предупреждение',
                            notes: 'заметку'
                        };
                        const typeLabel = typeLabels[punishmentType] || punishmentType;
                        
                        
                    } catch (e) {
                        console.log(`[Cancel] Не удалось отправить уведомление в чат ${chatId}:`, e.message);
                    }
                    
                    console.log(`[Cancel] ${logMessage}`);
                }

            } catch (e) {
                console.error(`[Cancel] Ошибка обработки записи:`, e);
                // Если ошибка, пропускаем этот элемент, но не добавляем в processed
                // чтобы можно было повторить позже
                remaining.push(item);
            }
        }

        // Если были изменения, перезаписываем файл, удаляя обработанные записи
        if (modified) {
            // Оставляем только те записи, которые ещё не обработаны
            const newPending = cancelData.pending.filter(item => {
                const key = `${item.chatId}_${item.userId}_${item.punishmentType}_${item.index}`;
                return !processedCancellations.has(key);
            });

            if (newPending.length === 0) {
                // Если все обработаны — удаляем файл
                fs.unlinkSync(CANCEL_FILE);
                console.log('[Cancel] Файл отмен очищен (все наказания обработаны)');
            } else {
                // Иначе сохраняем оставшиеся
                fs.writeFileSync(CANCEL_FILE, JSON.stringify({ pending: newPending }, null, 2), 'utf8');
                console.log(`[Cancel] Осталось ${newPending.length} наказаний на отмену`);
            }
        }

    } catch (e) {
        console.error('[Cancel] Ошибка обработки отмен:', e);
    }
}

setInterval(processCancellations, 10 * 1000);

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;
    const messageId = query.message.message_id;
    const settings = getChatSettings(chatId);
    

    if (data.startsWith('captcha_')) {
        const parts = data.split('_');
        const targetUserId = parseInt(parts[1]);
        const action = parts[2] || 'verify';
        const selectedAnswer = parts[2] ? parseInt(parts[2]) : null;
        
        if (query.from.id !== targetUserId) {
            return bot.answerCallbackQuery(query.id, { 
                text: 'Эта кнопка не для вас!', 
                show_alert: true 
            });
        }

        if (!captchaStates[chatId] || !captchaStates[chatId][targetUserId]) {
            return bot.answerCallbackQuery(query.id, { 
                text: 'Вы уже прошли проверку или она неактивна.', 
                show_alert: true 
            });
        }

        const captchaData = captchaStates[chatId][targetUserId];
        if (Date.now() - captchaData.sentAt > 5 * 60 * 1000) {
            delete captchaStates[chatId][targetUserId];
            return bot.answerCallbackQuery(query.id, { 
                text: 'Время проверки истекло. Попробуйте выйти и зайти заново.', 
                show_alert: true 
            });
        }

        if (action !== 'verify' && captchaData.type === 'hard') {
            const isCorrect = (selectedAnswer === captchaData.correctAnswer);
            
            if (isCorrect) {
                
                try {
                    await bot.restrictChatMember(chatId, targetUserId, {
                        can_send_messages: true,
                        can_send_media_messages: true,
                        can_send_polls: true,
                        can_send_other_messages: true,
                        can_add_web_page_previews: true,
                        can_react_to_messages: true
                    });

                    const messageId = captchaData.messageId;
                    if (messageId) {
                        try {
                            let newText = settings.welcomeMessageText || 'Добро пожаловать в чат, ?name!';
                            const mention = `<a href="tg://user?id=${targetUserId}">${query.from.first_name}</a>`;
                            newText = newText.replace(/\?name/g, mention);
                            newText += '\n\nПроверка пройдена!';

                            await bot.editMessageText(newText, {
                                chat_id: chatId,
                                message_id: messageId,
                                parse_mode: 'HTML',
                                reply_markup: { inline_keyboard: [] }
                            });
                        } catch (e) {
                            console.error('Error editing captcha message:', e);
                            await bot.sendMessage(chatId, `${query.from.first_name}, вы успешно прошли проверку`);
                        }
                    }

                    delete captchaStates[chatId][targetUserId];
                    if (Object.keys(captchaStates[chatId]).length === 0) {
                        delete captchaStates[chatId];
                    }

                    await bot.answerCallbackQuery(query.id, { 
                        text: 'Проверка пройдена! Теперь вы можете писать в чат!' 
                    });

                } catch (e) {
                    console.error('Captcha verification error:', e);
                    await bot.answerCallbackQuery(query.id, { 
                        text: 'Ошибка при проверке. Напишите /help мне в лс и опишите ситуацию.', 
                        show_alert: true 
                    });
                }
                return;
            } else {
                
                const newProblem = generateMathProblem();
                captchaData.correctAnswer = newProblem.correctAnswer;
                captchaData.sentAt = Date.now(); 
                
                
                const keyboard = {
                    inline_keyboard: newProblem.options.map(opt => [
                        { text: String(opt), callback_data: `captcha_${targetUserId}_${opt}` }
                    ])
                };

                try {
                    const settings = getChatSettings(chatId);
                    let welcomeText = settings.welcomeMessageText || 'Добро пожаловать в чат, ?name!';
                    const mention = `<a href="tg://user?id=${targetUserId}">${query.from.first_name}</a>`;
                    welcomeText = welcomeText.replace(/\?name/g, mention);
                    welcomeText += `\n\nРешите пример: ${newProblem.question}\n\n Неправильно! Попробуйте снова:`;

                    await bot.editMessageText(welcomeText, {
                        chat_id: chatId,
                        message_id: captchaData.messageId,
                        parse_mode: 'HTML',
                        reply_markup: keyboard
                    });

                    await bot.answerCallbackQuery(query.id, { 
                        text: 'Неправильно! Попробуйте ещё раз.', 
                        show_alert: true 
                    });
                } catch (e) {
                    console.error('Error updating captcha problem:', e);
                    await bot.answerCallbackQuery(query.id, { 
                        text: 'Ошибка при обновлении примера. Напишите мне /help в лс и опишите ситуацию.', 
                        show_alert: true 
                    });
                }
                return;
            }
        }

        
        if (captchaData.type === 'simple' || !captchaData.type) {
            try {
                await bot.restrictChatMember(chatId, targetUserId, {
                    can_send_messages: true,
                    can_send_media_messages: true,
                    can_send_polls: true,
                    can_send_other_messages: true,
                    can_add_web_page_previews: true,
                    can_react_to_messages: true
                });
                
                const messageId = captchaData.messageId;
                if (messageId) {
                    try {
                        let newText = settings.welcomeMessageText || 'Добро пожаловать в чат, ?name!';
                        const mention = `<a href="tg://user?id=${targetUserId}">${query.from.first_name}</a>`;
                        newText = newText.replace(/\?name/g, mention);
                        newText += '\n\nПроверка пройдена!';

                        await bot.editMessageText(newText, {
                            chat_id: chatId,
                            message_id: messageId,
                            parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: [] }
                        });
                    } catch (e) {
                        console.error('Error editing captcha message:', e);
                        await bot.sendMessage(chatId, `${query.from.first_name}, вы успешно прошли проверку!`);
                    }
                }

                delete captchaStates[chatId][targetUserId];
                if (Object.keys(captchaStates[chatId]).length === 0) {
                    delete captchaStates[chatId];
                }

                await bot.answerCallbackQuery(query.id, { 
                    text: 'Проверка пройдена! Теперь вы можете писать в чат!' 
                });

            } catch (e) {
                console.error('Captcha verification error:', e);
                await bot.answerCallbackQuery(query.id, { 
                    text: 'Ошибка при проверке. Напишите мне /help в лс и опишите проблему.', 
                    show_alert: true 
                });
            }
            return;
        }
        return;
    }

    if (data.startsWith('forbidden_')) {
    const parts = data.split('_');
    const action = parts[1];
    const chatId = parseInt(parts[2]);
    const messageId = parseInt(parts[3]);
    
    const isAdmin = (await bot.getChatAdministrators(chatId)).some(a => a.user.id === userId);
    if (!isAdmin) {
        return bot.answerCallbackQuery(query.id, { text: 'Только модераторы могут это делать', show_alert: true });
    }
    
    // Получаем информацию о репорте
    const report = reportStates[query.message.message_id];
    if (!report || report.type !== 'forbidden') {
        return bot.answerCallbackQuery(query.id, { text: 'Репорт не найден или уже обработан', show_alert: true });
    }
    
    if (action === 'delete') {
        // Удаляем сообщение нарушителя
        try {
            await bot.deleteMessage(chatId, messageId);
        } catch (e) {
            console.error('Ошибка удаления сообщения:', e);
        }
        
        // Отмечаем репорт как обработанный
        delete reportStates[query.message.message_id];
        
        // Редактируем сообщение репорта
        const oldText = query.message.text;
        const newText = `ЗАПРЕЩЁННОЕ СЛОВО ОБРАБОТАНО (сообщение удалено)\n\n` + oldText;
        await bot.editMessageText(newText, {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: {}
        });
        
        return bot.answerCallbackQuery(query.id, { text: 'Сообщение удалено' });
    }
    
    if (action === 'warn' || action === 'mute' || action === 'ban') {
        // Используем существующую логику из executeQuickAction
        const offenderId = report.userId;
        const settings = getChatSettings(chatId);
        let punishmentText = '';
        
        try {
            if (action === 'warn') {
                const warnEntry = {
                    active: true,
                    permanent: false,
                    issuedAt: new Date().toISOString(),
                    messageText: null,
                    messageId: messageId,
                    reason: 'Запрещённое слово (автоматическое обнаружение)',
                    adminId: userId,
                    removedAt: null,
                    removedBy: null
                };
                const logs = loadLogs(chatId);
                const user = getUser(logs, offenderId);
                user.totalPunishments++;
                user.warns.push(warnEntry);
                saveLogs(chatId, logs);
                
                const ulogs = loadUserLogs(offenderId);
                const u = getUserGlobal(ulogs, offenderId);
                u.totalPunishments++;
                u.warns.push({ ...warnEntry, chatId: chatId });
                saveUserLogs(offenderId, ulogs);
                
                await checkWarnPunishment(chatId, offenderId);
                punishmentText = 'предупреждение';
            } else if (action === 'mute') {
                const duration = ParseDuration(settings.quickMuteDuration);
                if (!duration) throw new Error('Неверная длительность мута');
                const untilDate = Math.floor(Date.now() / 1000) + duration;
                await bot.restrictChatMember(chatId, offenderId, {
                    permissions: {
                        can_send_messages: false,
                        can_send_media_messages: false,
                        can_send_polls: false,
                        can_send_other_messages: false,
                        can_add_web_page_previews: false,
                    },
                    until_date: untilDate
                });
                
                const muteEntry = {
                    active: true,
                    issuedAt: new Date().toISOString(),
                    messageText: null,
                    messageId: messageId,
                    reason: 'Запрещённое слово (автоматическое обнаружение)',
                    adminId: userId,
                    expiresAt: new Date(Date.now() + duration * 1000).toISOString(),
                    removedAt: null,
                    removedBy: null
                };
                const logs = loadLogs(chatId);
                const user = getUser(logs, offenderId);
                user.totalPunishments++;
                user.mutes.push(muteEntry);
                saveLogs(chatId, logs);
                
                const ulogs = loadUserLogs(offenderId);
                const u = getUserGlobal(ulogs, offenderId);
                u.totalPunishments++;
                u.mutes.push({ ...muteEntry, chatId: chatId });
                saveUserLogs(offenderId, ulogs);
                
                punishmentText = `мут на ${settings.quickMuteDuration}`;
            } else if (action === 'ban') {
                await bot.banChatMember(chatId, offenderId);
                
                const banEntry = {
                    active: true,
                    issuedAt: new Date().toISOString(),
                    messageText: null,
                    messageId: messageId,
                    reason: 'Запрещённое слово (автоматическое обнаружение)',
                    adminId: userId,
                    expiresAt: null,
                    removedAt: null,
                    removedBy: null
                };
                const logs = loadLogs(chatId);
                const user = getUser(logs, offenderId);
                user.totalPunishments++;
                user.bans.push(banEntry);
                saveLogs(chatId, logs);
                
                const ulogs = loadUserLogs(offenderId);
                const u = getUserGlobal(ulogs, offenderId);
                u.totalPunishments++;
                u.bans.push({ ...banEntry, chatId: chatId });
                saveUserLogs(offenderId, ulogs);
                
                punishmentText = 'бан';
            }
            
            // Удаляем сообщение нарушителя
            try {
                await bot.deleteMessage(chatId, messageId);
            } catch (e) {}
            
            // Отмечаем репорт как обработанный
            delete reportStates[query.message.message_id];
            
            // Редактируем сообщение репорта
            const oldText = query.message.text;
            const newText = `ЗАПРЕЩЁННОЕ СЛОВО ОБРАБОТАНО (наказание: ${punishmentText})\n\n` + oldText;
            await bot.editMessageText(newText, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: {}
            });
            
            return bot.answerCallbackQuery(query.id, { text: `Выполнено: ${punishmentText}` });
            
        } catch (e) {
            console.error('Ошибка применения наказания:', e);
            return bot.answerCallbackQuery(query.id, { text: 'Ошибка при выполнении действия', show_alert: true });
        }
    }
    
    if (action === 'reject') {
        delete reportStates[query.message.message_id];
        const oldText = query.message.text;
        const newText = ` ЗАПРЕЩЁННОЕ СЛОВО ОТКЛОНЕНО\n\n` + oldText;
        await bot.editMessageText(newText, {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: {}
        });
        return bot.answerCallbackQuery(query.id, { text: 'Репорт отклонён' });
    }
    
    if (action === 'done') {
        delete reportStates[query.message.message_id];
        const oldText = query.message.text;
        const newText = ` ЗАПРЕЩЁННОЕ СЛОВО ПРОВЕРЕНО (без наказания)\n\n` + oldText;
        await bot.editMessageText(newText, {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: {}
        });
        return bot.answerCallbackQuery(query.id, { text: 'Репорт отмечен как проверенный' });
    }
}

    if (data.startsWith('settings_')) {
        try {
            const admins = await bot.getChatAdministrators(chatId);
            const isAdmin = admins.some(a => a.user.id === userId);

            if (!isAdmin) {
                return bot.answerCallbackQuery(query.id, {
                    text: 'Только администраторы могут управлять настройками.',
                    show_alert: true
                });
            }

            await bot.answerCallbackQuery(query.id);

            if (data === 'settings_back') {
                await showSettingsMenu(chatId, messageId);
                return;
            }

            if (data.startsWith('settings_edit_')) {
                const key = data.replace('settings_edit_', '');
                await showSettingEdit(chatId, messageId, key);
                return;
            }

            if (data.startsWith('settings_reset_')) {
                const key = data.replace('settings_reset_', '');
                const defaultValue = getNestedValue(defaultSettings, key);
                
                updateChatSetting(chatId, key, defaultValue);
                invalidateSettingsCache(chatId);
                
                await showSettingEdit(chatId, messageId, key);
                return;
            }
            if (data === 'settings_back') {
                if (!settingsInputStates[chatId]) {
                    settingsInputStates[chatId] = {};
                }
                
                const returnPage = settingsInputStates[chatId].returnPage || 0;
                
                delete settingsInputStates[chatId].returnPage;
                
                settingsInputStates[chatId].currentPage = returnPage;
                await showSettingsMenu(chatId, messageId, returnPage);
                return;
            }

            if (data.startsWith('settings_page_')) {
                const page = parseInt(data.replace('settings_page_', ''));
                if (!settingsInputStates[chatId]) {
                    settingsInputStates[chatId] = {};
                }
                settingsInputStates[chatId].currentPage = page;
                
                delete settingsInputStates[chatId].returnPage;
                await showSettingsMenu(chatId, messageId, page);
                return;
            }

            if (data.startsWith('settings_set_')) {
                const parts = data.replace('settings_set_', '').split('_');
                const key = parts.slice(0, -1).join('.');
                const value = parts[parts.length - 1];
                
                let parsedValue;
                if (value === 'true') parsedValue = true;
                else if (value === 'false') parsedValue = false;
                else parsedValue = value;

                updateChatSetting(chatId, key, parsedValue);
                invalidateSettingsCache(chatId);
                
                await showSettingEdit(chatId, messageId, key);
                return;
            }

            if (data.startsWith('settings_input_')) {
                const key = data.replace('settings_input_', '');
                
                if (!settingsInputStates[chatId]) {
                    settingsInputStates[chatId] = {};
                }
                settingsInputStates[chatId].awaitingInput = {
                    key: key,
                    userId: userId,
                    messageId: messageId
                };

                const displayName = getSettingDisplayName(key);
                const settings = getChatSettings(chatId);
                const currentValue = getNestedValue(settings, key);
                const type = getSettingType(currentValue);
                
                let instructions = `<b>Введите новое значение для "${displayName}"</b>\n\n`;
                instructions += `Текущее значение: ${formatSettingValue(currentValue)}\n`;
                instructions += `Тип: ${type}\n\n`;
                
                if (type === 'string') {
                    instructions += 'Просто отправьте текст в чат.\n';
                } else if (type === 'number') {
                    instructions += 'Введите число (например: 10, 30, 60).\n';
                } else if (type === 'null') {
                    instructions += 'Введите значение (текст или число), или напишите "null" чтобы установить пустое значение.\n';
                }
                
                instructions += '\nЧтобы отменить, просто напишите /settings заново.';

                await bot.editMessageText(instructions, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML'
                });
                return;
            }

        } catch (e) {
            console.error('Settings callback error:', e);
            try {
                await bot.answerCallbackQuery(query.id, {
                    text: 'Ошибка',
                    show_alert: true
                });
            } catch (err) {}
        }
        return;
    }

    try {
        if (!reportStates[messageId]) {
        } else {
            const state = reportStates[messageId];
            const isAdmin = (await bot.getChatAdministrators(chatId)).some(a => a.user.id === userId);
            if (!isAdmin) {
                return bot.answerCallbackQuery(query.id, { text: 'Только модераторы могут это делать', show_alert: true });
            }

            let report = null;
            let reportChatId = null;
            
            const chatFiles = fs.readdirSync(CHAT_LOG_DIR);
            for (const file of chatFiles) {
                const chatIdFile = file.replace('_logs.json', '');
                const logs = loadLogs(chatIdFile);
                if (logs._reports) {
                    const found = logs._reports.find(r => r.reportMessageId === messageId);
                    if (found) {
                        report = found;
                        reportChatId = chatIdFile;
                        break;
                    }
                }
            }

            if (!report || !reportChatId) {
                return;
            }

            if (report.checked) {
                return bot.answerCallbackQuery(query.id, { text: 'Этот репорт уже обработан' });
            }

            if (data === 'report_done') {
                markReportAsChecked(reportChatId, messageId, userId);
                
                const oldText = query.message.text;
                const newText = 'РЕПОРТ ПРОВЕРЕН (без наказания)\n\n' + oldText;
                await bot.editMessageText(newText, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML',
                    disable_web_page_preview: true,
                    reply_markup: {}
                });
                delete reportStates[messageId];
                return bot.answerCallbackQuery(query.id, { text: 'Я отметила репорт как проверенный' });
            }

            const action = data;

            if (state.pendingAction === action && Date.now() - state.lastPress < 3000) {
                clearTimeout(state.timer);
                state.pendingAction = null;
                state.lastPress = null;
                state.timer = null;
                await executeQuickAction(query, action, reportChatId, messageId, report);
                return;
            } else {
                if (state.timer) clearTimeout(state.timer);
                state.pendingAction = action;
                state.lastPress = Date.now();
                state.timer = setTimeout(() => {
                    state.pendingAction = null;
                    state.lastPress = null;
                    state.timer = null;
                }, 3000);
                bot.answerCallbackQuery(query.id, { text: 'Нажмите ещё раз в течение 3 секунд для подтверждения' });
                return;
            }
        }
    } catch (e) {
        console.error('Report callback error:', e);
        bot.answerCallbackQuery(query.id, { text: 'Ошибка' });
        return;
    }

    try {
        if (data.startsWith('urgency_')) {
            const urgencyMap = { high: 'Максимальная', medium: 'Умеренная', low: 'Низкая' };
            const urgency = data.split('_')[1];
            const state = ticketCreationStates[userId];
            if (!state || state.step !== 'awaiting_urgency') {
                return bot.answerCallbackQuery(query.id, { text: 'Что-то пошло не так. Попробуйте начать заново /help' });
            }
            state.urgency = urgencyMap[urgency] || 'Низкая';

            const ticketNumber = generateTicketNumber();
            const ticket = {
                ticketNumber,
                userId: userId,
                userName: query.from.first_name,
                topic: state.topic,
                description: state.description,
                media: state.media || [],
                urgency: state.urgency,
                status: 'open',
                createdAt: new Date().toISOString(),
                topicId: null,
                messages: []
            };

            const tickets = loadTickets();
            tickets[ticketNumber] = ticket;
            saveTickets(tickets);
            delete ticketCreationStates[userId];

            const userMsg = `Тикет #${ticketNumber} создан.\n` +
                            `Тема: ${ticket.topic}\n` +
                            `Статус: открыт\n` +
                            `Для отправки сообщений оператору (в т.ч. для ответов на его сообщения) (в т.ч. для отправки медиафайлов) нажимайте кнопку "Отправить дополнительно". \n Вы можете закрепить это сообщение для удобства.`;
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: 'Отправить дополнительно', callback_data: `extra_${ticketNumber}` },
                        { text: 'Закрыть тикет', callback_data: `close_${ticketNumber}` }
                    ]
                ]
            };
            await bot.sendMessage(chatId, userMsg, { reply_markup: keyboard });

            try {
                const topicName = `Тикет #${ticketNumber}: ${ticket.topic.substring(0, 30)}`;
                const topic = await bot.createForumTopic(supportChat, topicName);
                ticket.topicId = topic.message_thread_id;
                
                let content = `<b>Тема:</b> ${ticket.topic}\n<b>Описание:</b> ${ticket.description || '—'}\n<b>Срочность:</b> ${ticket.urgency}`;
                if (ticket.media.length) {
                    content += `\n<b>Вложения:</b> ${ticket.media.length} файлов`;
                }
                await bot.sendMessage(supportChat, content, {
                    message_thread_id: ticket.topicId,
                    parse_mode: 'HTML'
                });
                if (ticket.media.length > 0) {
                    for (const m of ticket.media) {
                        try {
                            await bot.sendMessage(supportChat, '', {
                                message_thread_id: ticket.topicId,
                                [m.type]: m.file_id
                            });
                        } catch (err) {
                            console.error('Ошибка отправки медиа в тикете:', err);
                        }
                    }
                }
                
                const pinnedMsg = await bot.sendMessage(supportChat, 'Данный тикет открыт. Для помощи отвечайте в этой ветке.', {
                    message_thread_id: ticket.topicId
                });
                await bot.pinChatMessage(supportChat, pinnedMsg.message_id, { message_thread_id: ticket.topicId });

                tickets[ticketNumber] = ticket;
                saveTickets(tickets);

                bot.answerCallbackQuery(query.id, { text: 'Тикет создан!' });
            } catch (e) {
                console.error('Ошибка создания темы:', e);
                return bot.sendMessage(chatId, 'Я не смогла создать тему в группе поддержки. Я правда пыталась, но что-то пошло не так. Обратитесь в личные сообщения администратора @holy_inquizitor');
            }
            return;
        }

        if (data.startsWith('extra_')) {
            const ticketNumber = parseInt(data.split('_')[1]);
            const tickets = loadTickets();
            const ticket = tickets[ticketNumber];
            if (!ticket || ticket.status !== 'open') {
                return bot.answerCallbackQuery(query.id, { text: 'Тикет не найден или закрыт.' });
            }
            
            ticketCreationStates[userId] = { step: 'extra_message', ticketNumber };
            bot.sendMessage(chatId, 'Отправьте дополнительное сообщение (до 800 символов) и до 5 медиафайлов. Фото обязательно отправлять как файл!!!');
            bot.answerCallbackQuery(query.id);
            return;
        }

        if (data.startsWith('close_')) {
            const ticketNumber = parseInt(data.split('_')[1]);
            const tickets = loadTickets();
            const ticket = tickets[ticketNumber];
            if (!ticket || ticket.status !== 'open') {
                return bot.answerCallbackQuery(query.id, { text: 'Тикет не найден или закрыт.' });
            }
            
            const code = Math.floor(1000 + Math.random() * 9000);
            confirmCloseStates[userId] = { code, timer: null, ticketNumber };
            const confirmMsg = await bot.sendMessage(chatId,
                `Для подтверждения закрытия тикета #${ticketNumber} отправьте сообщение: ЗАКРЫТЬ ${code}. У вас 20 секунд.`
            );
            
            const timer = setTimeout(() => {
                delete confirmCloseStates[userId];
                bot.editMessageText('Время вышло. Закрытие отменено.', {
                    chat_id: chatId,
                    message_id: confirmMsg.message_id
                });
            }, 20000);
            confirmCloseStates[userId].timer = timer;
            bot.answerCallbackQuery(query.id);
            return;
        }

        

        if (data.startsWith('rate_')) {
            const parts = data.split('_');
            const rate = parseInt(parts[1]);
            const ticketNumber = parseInt(parts[2]);
            const who = parts[3];

            const ratings = loadRatings();
            if (!ratings[ticketNumber]) ratings[ticketNumber] = {};

            if (who === 'user') {
                ratings[ticketNumber].userRating = rate === 0 ? null : rate;
                await bot.sendMessage(chatId, 'Спасибо за оценку!');
            } else if (who === 'helper') {
                ratings[ticketNumber].helperRating = rate === 0 ? null : rate;
                const tickets = loadTickets();
                const ticket = tickets[ticketNumber];
                if (ticket && ticket.topicId) {
                    await bot.sendMessage(supportChat, `Оператор оценил пользователя на ${rate} ★`, {
                        message_thread_id: ticket.topicId
                    });
                }
                await bot.sendMessage(chatId, 'Оценка сохранена.');
            }
            saveRatings(ratings);

            try {
                await bot.deleteMessage(chatId, query.message.message_id);
            } catch (e) {
                console.error('Не удалось удалить сообщение с оценкой:', e);
            }

            bot.answerCallbackQuery(query.id);
            return;
        }

        // bot.js — добавьте в начало обработчика callback_query, после проверки captcha_



    } catch (e) {
        console.error('Ticket callback error:', e);
        try {
            await bot.answerCallbackQuery(query.id, { text: 'Ошибка' });
        } catch (err) {}
    }
    
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!settingsInputStates[chatId]?.awaitingInput) return;
    if (settingsInputStates[chatId].awaitingInput.userId !== userId) return;

    const state = settingsInputStates[chatId].awaitingInput;
    const key = state.key;
    const messageId = state.messageId;

    try {
        const admins = await bot.getChatAdministrators(chatId);
        const isAdmin = admins.some(a => a.user.id === userId);
        if (!isAdmin) {
            delete settingsInputStates[chatId].awaitingInput;
            return bot.sendMessage(chatId, 'Похоже вы не обладаете правами администратора в этой группе');
        }
    } catch {
        delete settingsInputStates[chatId].awaitingInput;
        return;
    }

    if (msg.text?.startsWith('/')) {
        delete settingsInputStates[chatId].awaitingInput;
        await showSettingsMenu(chatId, messageId);
        return;
    }

    const settings = getChatSettings(chatId);
    const currentValue = getNestedValue(settings, key);
    const type = getSettingType(currentValue);
    let newValue = msg.text?.trim() || '';

    let parsedValue;
    try {
        if (newValue.toLowerCase() === 'null' || newValue === '') {
            parsedValue = null;
        } else if (type === 'number') {
            parsedValue = parseFloat(newValue);
            if (isNaN(parsedValue)) {
                return bot.sendMessage(chatId, 'Пожалуйста, введите корректное число.');
            }
            if (key === 'raidSensitivity') {
                if (parsedValue < 1 || parsedValue > 5 || !Number.isInteger(parsedValue)) {
                    return bot.sendMessage(chatId, 'Пожалуйста, введите целое число от 1 до 5.');
                }
            }
        } else {
            parsedValue = newValue;
        }
    } catch (e) {
        return bot.sendMessage(chatId, 'Неверный формат значения.');
    }

    updateChatSetting(chatId, key, parsedValue);
    invalidateSettingsCache(chatId);

    delete settingsInputStates[chatId].awaitingInput;

    await showSettingEdit(chatId, messageId, key);
    
    bot.sendMessage(chatId, 'Я поменяла эту настройку!', {
        reply_to_message_id: msg.message_id
    });
});
async function closeTicket(ticketNumber, userId, closedBy) {
    const tickets = loadTickets();
    const ticket = tickets[ticketNumber];
    if (!ticket || ticket.status === 'closed') return;

    
    ticket.status = 'closed';
    ticket.closedAt = new Date().toISOString();
    ticket.closedBy = userId;
    tickets[ticketNumber] = ticket;
    saveTickets(tickets);

    
    try {
        const topicName = `Тикет #${ticketNumber}: ${ticket.topic.substring(0, 30)}`;
        await bot.setForumTopicTitle(supportChat, ticket.topicId, topicName);
    } catch (e) {}

    
    const userChatId = ticket.userId;
    const userMsg = `Тикет #${ticketNumber} закрыт.`;
    await bot.sendMessage(userChatId, userMsg);

    
    const rateKeyboard = {
        inline_keyboard: [
            [
                { text: '⭐ 1', callback_data: `rate_1_${ticketNumber}_user` },
                { text: '⭐ 2', callback_data: `rate_2_${ticketNumber}_user` },
                { text: '⭐3', callback_data: `rate_3_${ticketNumber}_user` },
                { text: '⭐4', callback_data: `rate_4_${ticketNumber}_user` },
                { text: '⭐ 5', callback_data: `rate_5_${ticketNumber}_user` }
            ],
            [{ text: '❌ Отказаться', callback_data: `rate_0_${ticketNumber}_user` }]
        ]
    };
    await bot.sendMessage(userChatId, 'Оцените, пожалуйста, работу службы поддержки (от 1 до 5):', { reply_markup: rateKeyboard });

    
    if (closedBy !== ticket.userId) { 
        const helperKeyboard = {
            inline_keyboard: [
                [
                    { text: '⭐ 1', callback_data: `rate_1_${ticketNumber}_helper` },
                    { text: '⭐ 2', callback_data: `rate_2_${ticketNumber}_helper` },
                    { text: '⭐ 3', callback_data: `rate_3_${ticketNumber}_helper` },
                    { text: '⭐ 4', callback_data: `rate_4_${ticketNumber}_helper` },
                    { text: '⭐ 5', callback_data: `rate_5_${ticketNumber}_helper` }
                ],
                [{ text: '❌ Отказаться', callback_data: `rate_0_${ticketNumber}_helper` }]
            ]
        };
        await bot.sendMessage(supportChat, 'Оцените пользователя (от 1 до 5):', {
            message_thread_id: ticket.topicId,
            reply_markup: helperKeyboard
        });
    }

    
    delete confirmCloseStates[userId];
}


bot.on('message', async (msg) => {
    
    if (msg.chat.id !== parseInt(supportChat)) return;
    if (!msg.message_thread_id) return;
    if (msg.from.is_bot) return;

    const state = confirmCloseStates[msg.from.id];
    if (state && msg.text === `ЗАКРЫТЬ ${state.code}`) {
        clearTimeout(state.timer);
        delete confirmCloseStates[msg.from.id];
        await closeTicket(state.ticketNumber, msg.from.id, 'helper');
        return;
    }

    
    const tickets = loadTickets();
    const ticket = Object.values(tickets).find(t => t.topicId === msg.message_thread_id && t.status === 'open');
    if (!ticket) return;

    
    const admins = await bot.getChatAdministrators(supportChat);
    const isAdmin = admins.some(a => a.user.id === msg.from.id);

    if (isAdmin) {
        
        const text = msg.text || '';
        
        
        if (text.startsWith('/close')) return;
        if (text.match(/^ЗАКРЫТЬ \d{4}$/)) return;

        
        try {
            let forwardText = '<b>Ответ помощника</b>\n\n';
            if (msg.text) forwardText += msg.text;
            if (msg.caption) forwardText += msg.caption;

            await bot.sendMessage(ticket.userId, forwardText, { parse_mode: 'HTML' });

           
            if (msg.photo) {
                const largestPhoto = msg.photo[msg.photo.length - 1];
                await bot.sendPhoto(ticket.userId, largestPhoto.file_id, {
                    caption: '<b>Ответ помощника</b>',
                    parse_mode: 'HTML'
                });
            } 


            if (msg.video) {
                await bot.sendVideo(ticket.userId, msg.video.file_id, {
                    caption: msg.text || msg.caption || 'Ответ помощника'
                });
            }
            if (msg.document) {
                await bot.sendDocument(ticket.userId, msg.document.file_id, {
                    caption: msg.text || msg.caption || 'Ответ помощника'
                });
            }
            if (msg.audio) {
                await bot.sendAudio(ticket.userId, msg.audio.file_id, {
                    caption: msg.text || msg.caption || 'Ответ помощника'
                });
            }
            if (msg.animation) {
                await bot.sendAnimation(ticket.userId, msg.animation.file_id, {
                    caption: msg.text || msg.caption || 'Ответ помощника'
                });
            }
        } catch (e) {
            console.error('Не удалось переслать ответ помошника:', e);
        }
        return;
    }
    return;
});











const DATA_FILE = path.join(__dirname, 'online_panel_data.json');

function generateSecretCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789=+-_)(*?:%;№"!/\|,.><~';
    let code = '';
    for (let i = 0; i < 13; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function readData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Ошибка чтения файла:', error);
    }
    return {};
}

function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Ошибка записи в файл:', error);
        return false;
    }
}

async function handleOnlinePanel(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'Unknown';
    const chatType = msg.chat.type;

    if (chatType === 'private' || chatType === 'channel') {
        return bot.sendMessage(chatId, 'Используйте эту команду только в чате'); 
    }

    try {
        const chatMember = await bot.getChatMember(chatId, userId);
        if (!chatMember || !['administrator', 'creator'].includes(chatMember.status)) {
            return;
        }

        try {
            await bot.sendChatAction(userId, 'typing');
        } catch (error) {
            await bot.sendMessage(chatId, 'Пожалуйста, напишите /start мне в личные сообщения, чтобы я могла отправить вам ваш уникальный код, а потом используйте команду /onlinepanel в этом чате ещё раз', { reply_to_message_id: msg.message_id});
            return;
        }

        let data = readData();

        const userExists = data[userId] !== undefined;

        if (userExists) {
            const userData = data[userId];
            
            if (userData.chats && userData.chats.includes(chatId)) {
                
                await bot.sendMessage(chatId, 'Этот чат уже зарегистрирован в моей системе.', { reply_to_message_id: msg.message_id});
                return;
            }

            if (!userData.chats) {
                userData.chats = [];
            }
            userData.chats.push(chatId);
            
            userData.username = username;
            
            if (writeData(data)) {
                await bot.sendMessage(chatId, 'Я успешно добавила этот чат в систему!', { reply_to_message_id: msg.message_id});
            }
            return;
        }

        const secretCode = generateSecretCode();
        
        data[userId] = {
            chats: [chatId],
            username: username,
            secretCode: secretCode,
            registeredAt: new Date().toISOString()
        };

        if (writeData(data)) {
            try {
                await bot.sendMessage(userId, 
                    `Ваш уникальный код:\n\n<code>${secretCode}</code>\n\n Никому не сообщайте этот код, даже оператору службы поддержки бота!\n\nДля смены кода используйте команду /updatesecretcode или напишите в поддержку (команда /help)`,
                    { parse_mode: 'HTML' }
                );
                
                await bot.sendMessage(chatId, 'Я вас зарегистрировавла! Код отправлен вам в личные сообщения.'), { reply_to_message_id: msg.message_id};
            } catch (error) {
                await bot.sendMessage(chatId, 'Я не смогла отправить вам код в ЛС. Пожалуйста, напишите мне /start в личные сообщения, а потом используйте команду /onlinepanel в этом чате ещё раз', { reply_to_message_id: msg.message_id});
            }
        }
    } catch (error) {
        console.error('Ошибка в /onlinepanel:', error);
        await bot.sendMessage(chatId, 'Простите, я не смогла это сделать. Я правда пыталась, но что-то пошло не так', { reply_to_message_id: msg.message_id});
        return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
    }
}

async function handleUpdateSecretCode(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (msg.chat.type !== 'private') {
        await bot.sendMessage(chatId, 'Эта команда доступна только в личных сообщениях.', { reply_to_message_id: msg.message_id});
        return;
    }

    try {
        let data = readData();
        
        if (!data[userId]) {
            await bot.sendMessage(chatId, 'Вы не зарегистрированы в системе. Используйте /onlinepanel в чате, где вы администратор.');
            return;
        }

        const newCode = generateSecretCode();
        data[userId].secretCode = newCode;
        data[userId].updatedAt = new Date().toISOString();

        if (writeData(data)) {
            await bot.sendMessage(chatId, 
                `Ваш код обновлён!\n\nНовый код:\n<code>${newCode}</code>\n\nНикому не сообщайте этот код, даже оператору службы поддержки бота!`,
                { parse_mode: 'HTML' }
            );
        }
    } catch (error) {
        console.error('Ошибка в /updatesecretcode:', error);
        await bot.sendMessage(chatId, 'Простите, я не смогла это сделать. Я правда пыталась, но что-то пошло не так', { reply_to_message_id: msg.message_id});
        return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
    }
}

async function handleUpdateOnlineAdmins(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const chatType = msg.chat.type;

    if (chatType === 'private' || chatType === 'channel') {
        return;
    }

    try {
        const chatMember = await bot.getChatMember(chatId, userId);
        if (!chatMember || !['administrator', 'creator'].includes(chatMember.status)) {
            return; 
        }

        let data = readData();
        let removedUsers = [];
        let modified = false;

        for (const [userIdKey, userData] of Object.entries(data)) {
            if (userData.chats && userData.chats.includes(chatId)) {
                try {
                    const memberInfo = await bot.getChatMember(chatId, parseInt(userIdKey));
                    
                    if (!memberInfo || !['administrator', 'creator'].includes(memberInfo.status)) {
                        
                        const chatIndex = userData.chats.indexOf(chatId);
                        if (chatIndex !== -1) {
                            userData.chats.splice(chatIndex, 1);
                            removedUsers.push(userIdKey);
                            modified = true;
                            
                            if (userData.chats.length === 0) {
                                delete data[userIdKey];
                            }
                        }
                    }
                } catch (error) {
                    const chatIndex = userData.chats.indexOf(chatId);
                    if (chatIndex !== -1) {
                        userData.chats.splice(chatIndex, 1);
                        removedUsers.push(userIdKey);
                        modified = true;
                        
                        if (userData.chats.length === 0) {
                            delete data[userIdKey];
                        }
                    }
                }
            }
        }

        if (modified) {
            if (writeData(data)) {
                let response = 'Обновление завершено.\n';
                if (removedUsers.length > 0) {
                    response += `\nУдалены пользователи, переставшие быть администраторами: ${removedUsers.join(', ')}`;
                } else {
                    response += '\nВсе администраторы остаются в системе.';
                }
                await bot.sendMessage(chatId, response);
            }
        } else {
            await bot.sendMessage(chatId, 'Я не нашла пользователей, которых нужно удалить.');
        }
    } catch (error) {
        console.error('Ошибка в /updateonlineadmins:', error);
        await bot.sendMessage(chatId, 'Простите, я не смогла это сделать. Я правда пыталась, но что-то пошло не так', { reply_to_message_id: msg.message_id});
        return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
    }
}


module.exports = {
    handleOnlinePanel,
    handleUpdateSecretCode,
    handleUpdateOnlineAdmins,
    readData,
    writeData,
    generateSecretCode
};


bot.onText(/\/onlinepanel/, (msg) => handleOnlinePanel(bot, msg));
bot.onText(/\/updatesecretcode/, (msg) => handleUpdateSecretCode(bot, msg));
bot.onText(/\/updateonlineadmins/, (msg) => handleUpdateOnlineAdmins(bot, msg));


async function processAutoMessages() {
    try {
        
        const settingsFiles = fs.readdirSync(SETTINGS_DIR);
        
        for (const file of settingsFiles) {
            if (!file.endsWith('_settings.json')) continue;
            
            const chatId = file.replace('_settings.json', '');
            
            
            if (!/^-?\d+$/.test(chatId)) continue;
            
            const settings = getChatSettings(chatId);
            
            
            if (!settings.autoMessageEnabled) {
                
                if (autoMessageState[chatId]) {
                    clearTimeout(autoMessageState[chatId].timer);
                    delete autoMessageState[chatId];
                }
                continue;
            }
            
            if (!settings.autoMessageText || settings.autoMessageText.trim() === '') {
                continue;
            }
            
            const interval = ParseDuration(settings.autoMessageInterval);
            if (!interval || interval <= 0) {
                continue;
            }
            
            const messages = settings.autoMessageText
                .split('~*~')
                .map(msg => msg.trim())
                .filter(msg => msg.length > 0)
                .slice(0, 6); 
            
            if (messages.length === 0) {
                continue;
            }
            
            let validMessages = true;
            for (const msg of messages) {
                if (msg.length > 700) {
                    validMessages = false;
                    break;
                }
            }
            if (!validMessages) {
                continue;
            }
            
            if (!autoMessageState[chatId]) {
                autoMessageState[chatId] = {
                    currentIndex: 0,
                    timer: null,
                    lastSent: Date.now()
                };
            }
            
            const state = autoMessageState[chatId];
            
            const now = Date.now();
            const timeSinceLastSend = (now - state.lastSent) / 1000;
            
            if (timeSinceLastSend >= interval) {
                try {
                    const currentMessage = messages[state.currentIndex];
                    await bot.sendMessage(parseInt(chatId), currentMessage);
                    
                    state.lastSent = now;
                    state.currentIndex = (state.currentIndex + 1) % messages.length;
                    
                    
                } catch (e) {
                    console.error(`Error sending auto-message to chat ${chatId}:`, e);
                }
            }
        }
    } catch (e) {
        console.error('Process auto-messages error:', e);
    }
}

setInterval(processAutoMessages, 30 * 1000);



async function saveMessageStats(chatId, userId, date = new Date()) {
  try {
    let stats = {};
    if (fs.existsSync(MESSAGE_STATS_FILE)) {
      const raw = fs.readFileSync(MESSAGE_STATS_FILE, 'utf8');
      stats = JSON.parse(raw);
    }
    
    const dateKey = date.toISOString().slice(0, 10); // YYYY-MM-DD
    const hourKey = date.getHours();
    const chatKey = String(chatId);
    
    if (!stats[chatKey]) {
      stats[chatKey] = {
        total: 0,
        days: {},
        hours: {},
        users: {}
      };
    }
    
    // Общая статистика
    stats[chatKey].total = (stats[chatKey].total || 0) + 1;
    
    // Статистика по дням
    if (!stats[chatKey].days[dateKey]) {
      stats[chatKey].days[dateKey] = 0;
    }
    stats[chatKey].days[dateKey]++;
    
    // Статистика по часам
    if (!stats[chatKey].hours[hourKey]) {
      stats[chatKey].hours[hourKey] = 0;
    }
    stats[chatKey].hours[hourKey]++;
    
    // Статистика по пользователям
    if (!stats[chatKey].users[userId]) {
      stats[chatKey].users[userId] = 0;
    }
    stats[chatKey].users[userId]++;
    
    // Очищаем старые данные (старше 30 дней)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoKey = thirtyDaysAgo.toISOString().slice(0, 10);
    
    for (const dayKey of Object.keys(stats[chatKey].days)) {
      if (dayKey < thirtyDaysAgoKey) {
        delete stats[chatKey].days[dayKey];
      }
    }
    
    fs.writeFileSync(MESSAGE_STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
  } catch (e) {
    console.error('Ошибка сохранения статистики сообщений:', e);
  }
}

// Функция для получения статистики сообщений
function getMessageStats(chatId, from, to) {
  try {
    if (!fs.existsSync(MESSAGE_STATS_FILE)) {
      return { days: [], hours: [], users: [], total: 0 };
    }
    
    const raw = fs.readFileSync(MESSAGE_STATS_FILE, 'utf8');
    const allStats = JSON.parse(raw);
    const chatStats = allStats[String(chatId)];
    
    if (!chatStats) {
      return { days: [], hours: [], users: [], total: 0 };
    }
    
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    
    // Фильтруем дни
    let days = Object.entries(chatStats.days || {})
      .filter(([date]) => {
        const d = new Date(date);
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
      })
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Часы
    const hours = Object.entries(chatStats.hours || {})
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => a.hour - b.hour);
    
    // Пользователи
    const users = Object.entries(chatStats.users || {})
      .map(([userId, count]) => ({ userId: parseInt(userId), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    
    return {
      days,
      hours,
      users,
      total: chatStats.total || 0
    };
  } catch (e) {
    console.error('Ошибка получения статистики сообщений:', e);
    return { days: [], hours: [], users: [], total: 0 };
  }
}



bot.on('message', async (msg) => {
  // === СОХРАНЕНИЕ СТАТИСТИКИ СООБЩЕНИЙ ===
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Сохраняем только для групп и супергрупп
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
      // Пропускаем служебные сообщения
      const serviceFields = [
        'left_chat_member', 'new_chat_title', 'new_chat_photo',
        'delete_chat_photo', 'group_chat_created', 'supergroup_chat_created',
        'channel_chat_created', 'pinned_message'
      ];
      if (!serviceFields.some(field => msg[field] !== undefined)) {
        await saveMessageStats(chatId, userId);
      }
    }
  } catch (e) {
    // Не критично, просто логируем
  }
  
  // === СУЩЕСТВУЮЩАЯ ЛОГИКА (обработка тикетов и т.д.) ===
  // ... ваш существующий код
});


// bot.js — замените существующую функцию refreshSettingsCache

async function refreshSettingsCache() {
    try {
        if (!fs.existsSync(SETTINGS_DIR)) {
            return;
        }
        
        const settingsFiles = fs.readdirSync(SETTINGS_DIR);
        
        // Полностью очищаем весь кеш
        settingsCache.clear();
        
        let loadedCount = 0;
        
        // Загружаем все настройки заново
        for (const file of settingsFiles) {
            if (!file.endsWith('_settings.json')) continue;
            
            const chatId = file.replace('_settings.json', '');
            const freshSettings = loadChatSettings(chatId);
            settingsCache.set(chatId, freshSettings);
            loadedCount++;
        }
        
        console.log(`[Cache] Полная перезагрузка: загружено ${loadedCount} настроек чатов`);
    } catch (e) {
        console.error('[Cache] Ошибка перезагрузки кеша:', e);
    }
}

// Запускаем полную перезагрузку кеша каждые 30 секунд
setInterval(refreshSettingsCache, 30 * 1000);

// Принудительная перезагрузка при запуске
setTimeout(async () => {
    console.log('[Cache] Первоначальная загрузка кеша настроек...');
    await refreshSettingsCache();
}, 3000);



// bot.js — добавьте в обработчик bot.on('message') после сохранения статистики


// bot.js — найдите этот обработчик в конце файла
// bot.js — добавьте в обработчик bot.on('message') после сохранения статистики

bot.on('message', async (msg) => {
  // === СОХРАНЕНИЕ СТАТИСТИКИ СООБЩЕНИЙ ===
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
      const serviceFields = [
        'left_chat_member', 'new_chat_title', 'new_chat_photo',
        'delete_chat_photo', 'group_chat_created', 'supergroup_chat_created',
        'channel_chat_created', 'pinned_message'
      ];
      if (!serviceFields.some(field => msg[field] !== undefined)) {
        await saveMessageStats(chatId, userId);
        
        // === ПРОВЕРКА НА ЗАПРЕЩЁННЫЕ СЛОВА ===
        await checkForbiddenWordsInMessage(msg);
      }
    }
  } catch (e) {
    // Не критично
  }
  
  // === СУЩЕСТВУЮЩАЯ ЛОГИКА (обработка тикетов и т.д.) ===
  // ... ваш существующий код
});

// Функция для проверки запрещённых слов в сообщении
async function checkForbiddenWordsInMessage(msg) {
    try {
        const chatId = msg.chat.id;
        const settings = getChatSettings(chatId);
        
        // Проверяем, включена ли функция
        if (!settings.forbiddenWordsEnabled) return;
        
        // Проверяем, есть ли текст в сообщении
        const text = msg.text || msg.caption || '';
        if (!text) return;
        
        // Проверяем, есть ли список запрещённых слов
        if (!settings.forbiddenWordsList) return;
        
        // Проверяем, есть ли чат модерации
        if (!settings.modchatID) return;
        
        // Проверяем, не является ли отправитель администратором
        try {
            const admins = await bot.getChatAdministrators(chatId);
            const isAdmin = admins.some(a => a.user.id === msg.from.id);
            if (isAdmin) return;
        } catch (e) {
            return;
        }
        
        // Проверяем текст на запрещённые слова
        const result = checkForbiddenWords(text, settings.forbiddenWordsList);
        if (!result) return;
        
        // Формируем репорт
        const reporter = bot.botInfo;
        const offender = msg.from;
        
        let messageLink = 'Сообщение недоступно';
        try {
            if (String(chatId).startsWith('-100')) {
                const internalId = String(chatId).replace('-100', '');
                messageLink = `https://t.me/c/${internalId}/${msg.message_id}`;
            }
        } catch {}
        
        const reportText = 
            `<b>• Обнаружено запрещённое слово</b>\n\n` +
            `<b>• Обнаружил бот</b>\n` +
            `<b>• На пользователя:</b>\n` +
            `<a href="tg://user?id=${offender.id}">${offender.first_name}</a>\n` +
            `ID: <code>${offender.id}</code>\n\n` +
            `<b>• Запрещённое слово:</b>\n${result.foundWord}\n\n` +
            `<b>• Слово в сообщении:</b>\n${result.matchedWord}\n\n` +
            `<b>• Полный текст:</b>\n${text.substring(0, 500)}${text.length > 500 ? '...' : ''}\n\n` +
            `<b>• Ссылка на сообщение:</b>\n<a href="${messageLink}">Перейти к сообщению</a>`;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: 'Удалить сообщение', callback_data: `forbidden_delete_${chatId}_${msg.message_id}` },
                    { text: 'Предупреждение', callback_data: `forbidden_warn_${chatId}_${msg.message_id}` }
                ],
                [
                    { text: `Мут ${settings.quickMuteDuration}`, callback_data: `forbidden_mute_${chatId}_${msg.message_id}` },
                    { text: 'Бан', callback_data: `forbidden_ban_${chatId}_${msg.message_id}` }
                ],
                [
                    { text: 'Отклонить', callback_data: `forbidden_reject_${chatId}_${msg.message_id}` },
                    { text: 'Отметить как проверенный', callback_data: `forbidden_done_${chatId}_${msg.message_id}` }
                ]
            ]
        };
        
        const sent = await bot.sendMessage(
            settings.modchatID,
            reportText,
            {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: keyboard
            }
        );
        
        // Сохраняем состояние репорта
        const reportId = sent.message_id;
        reportStates[reportId] = {
            type: 'forbidden',
            chatId: chatId,
            messageId: msg.message_id,
            userId: offender.id,
            timer: null,
            pendingAction: null,
            lastPress: null
        };
        
        console.log(`[Forbidden] Обнаружено запрещённое слово "${result.foundWord}" от пользователя ${offender.id} в чате ${chatId}`);
        
    } catch (e) {
        console.error('Ошибка проверки запрещённых слов:', e);
    }
}


// bot.js — замените функцию checkForbiddenWords

