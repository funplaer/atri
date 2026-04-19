const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');


const token = '8661483092:AAFyaAYm3Qyax48mRLGnWJzzAbmPrSi3h9c';
const bot = new TelegramBot(token, { polling: true });


const CHAT_LOG_DIR = path.join(__dirname, 'chat_logs');
const USER_LOG_DIR = path.join(__dirname, 'user_logs');
const userViewState = {}
const DEFAULT_CONFIG = {
    modchatID: '',
    commandCd: 5,
    WARN_EXPIRE: '14d',
    WARN_LIMIT: 3,
    WARN_PUNISHMENT: 'mute 1M авто мут за варны'
};
if (!fs.existsSync(CHAT_LOG_DIR)) fs.mkdirSync(CHAT_LOG_DIR);
if (!fs.existsSync(USER_LOG_DIR)) fs.mkdirSync(USER_LOG_DIR);

//настройки
const SETTINGS_DIR = path.join(__dirname, 'chat_settings');
if (!fs.existsSync(SETTINGS_DIR)) fs.mkdirSync(SETTINGS_DIR);

function getSettingsFile(chatId) {
    return path.join(SETTINGS_DIR, `${chatId}.json`);
}

function loadSettings(chatId) {
    const file = getSettingsFile(chatId);

    if (!fs.existsSync(file)) {
        const defaults = {
            modchatID: '',
            commandCd: 5,
            WARN_EXPIRE: '14d',
            WARN_LIMIT: 3,
            WARN_PUNISHMENT: 'mute 1M авто мут за варны'
        };

        fs.writeFileSync(file, JSON.stringify(defaults, null, 2));
        return defaults;
    }
    
     JSON.parse(fs.readFileSync(file));
}

function saveSettings(chatId, data) {
    fs.writeFileSync(getSettingsFile(chatId), JSON.stringify(data, null, 2));
}
function getChatConfig(chatId) {
    return loadSettings(chatId);
}

// кд команд
var lastcommand = 0;
setInterval(function() {
    lastcommand++
}, 1000)
// мут, бан, варн и тд
function typeName(type) {
    return {
        warns: 'Предупреждение',
        mutes: 'Мут',
        bans: 'Бан',
        notes: 'Заметка'
    }[type];
}

function buildPagedList(items, type, page = 0, perPage = 5) {
    const totalPages = Math.ceil(items.length / perPage);
    const start = page * perPage;
    const current = items.slice(start, start + perPage);

    const buttons = current.map((item, index) => {
        const realIndex = start + index + 1;

        let text = `${typeName(type)} ${realIndex}`;
        if (item.reason) text += ` (${item.reason.slice(0, 20)})`;

        return [{
            text,
            callback_data: `user_detail_${type}_${realIndex - 1}`
        }];
    });

    const navRow = [];

    if (page > 0) {
        navRow.push({ text: '<<', callback_data: `user_page_${type}_${page - 1}` });
    }

    if (page < totalPages - 1) {
        navRow.push({ text: '>>', callback_data: `user_page_${type}_${page + 1}` });
    }

    if (navRow.length) buttons.push(navRow);

    buttons.push([{ text: 'Назад', callback_data: 'user_back_types' }]);

    return { inline_keyboard: buttons };
}
async function isAdmin(chatId, userId) {
    try {
        const admins = await bot.getChatAdministrators(chatId);
        return admins.some(a => a.user.id === userId);
    } catch {
        return false;
    }
}
function parsePunishment(str) {
    const args = str.split(/\s+/).filter(Boolean);

    const type = args[0];
    args.shift();

    let duration = null;

    if (args.length && ParseDuration(args[0])) {
        duration = ParseDuration(args[0]);
        args.shift();
    }

    const reason = args.join(' ') || 'Авто наказание';

    return { type, duration, reason };
}
async function checkWarnPunishment(chatId, targetId) {
    const logs = loadLogs(chatId);
    const user = getUser(logs, targetId);

    const activeWarns = user.warns.filter(w => w.active).length;
    const config = getChatConfig(chatId);
    if (activeWarns < config.WARN_LIMIT) return;
    const alreadyPunished = user.mutes.some(m => m.active && m.adminId === 'system') ||
                            user.bans.some(b => b.active && b.adminId === 'system');

    if (alreadyPunished) return;
    
    const { type, duration, reason } = parsePunishment(config.WARN_PUNISHMENT);

    let untilDate = 0;
    if (duration) {
        untilDate = Math.floor(Date.now() / 1000) + duration;
    }

    try {
        if (type === 'mute') {
            await bot.restrictChatMember(chatId, targetId, {
                permissions: {
                    can_send_messages: false,
                    can_send_media_messages: false,
                    can_send_polls: false,
                    can_send_other_messages: false,
                    can_add_web_page_previews: false,
                },
                until_date: untilDate
            });
        }

        if (type === 'ban') {
            await bot.banChatMember(chatId, targetId, {
                until_date: untilDate
            });
        }

        const entry = {
            type,
            active: true,
            issuedAt: new Date().toISOString(),
            messageText: null,
            messageId: null,
            reason: `[AUTO] ${reason}`,
            adminId: 'system',
            expiresAt: duration ? new Date(Date.now() + duration * 1000).toISOString() : null,
            removedAt: null,
            removedBy: null
        };

        user.totalPunishments++;

        if (type === 'mute') {
            user.mutes.push(entry);
        }

        if (type === 'ban') {
            user.bans.push(entry);
        }

        saveLogs(chatId, logs);

        const ulogs = loadUserLogs(targetId);
        const u = getUserGlobal(ulogs, targetId);

        u.totalPunishments++;

        const globalEntry = {
            ...entry,
            chatId
        };

        if (type === 'mute') {
            u.mutes.push(globalEntry);
        }

        if (type === 'ban') {
            u.bans.push(globalEntry);
        }

        saveUserLogs(targetId, ulogs);

        const member = await bot.getChatMember(chatId, targetId).catch(() => null);
        const name = member?.user?.first_name || 'User';

        const mention = `<a href="tg://user?id=${targetId}">${name}</a>`;

        let text = `Автоматическое наказание для ${mention}\n`;

        if (type === 'mute') {
            text += `Запрет писать в чат`;
        } else {
            text += `Блокировка в чате`;
        }

        if (duration) {
            text += ` на ${formatDuration(duration)}`;
        } else {
            text += ` навсегда`;
        }
        const config = getChatConfig(chatId);
        text += `\nПричина: превышен лимит предупреждений (${config.WARN_LIMIT})`;

        await bot.sendMessage(chatId, text, {
            parse_mode: 'HTML'
        });

    } catch (e) {
        console.error('AUTO WARN PUNISH ERROR:', e);
        bot.sendMessage(chatId, 'Простите, произошла ошибка при попытке наказания за превышение лимита предупреждений. Я правда пыталась, но что-то пошло не так', {reply_to_message_id: msg.message_id})
        return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
    }
}
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
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify({}, null, 2));
        return {};
    }
    return JSON.parse(fs.readFileSync(file));
}

function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function loadLogs(chatId) {
    return loadJSON(getChatLogFile(chatId));
}

function saveLogs(chatId, data) {
    return saveJSON(getChatLogFile(chatId), data);
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
            warns: []
        };
    }

    const user = logs[userId];
    if (!user.mutes) user.mutes = [];
    if (!user.notes) user.notes = [];
    if (!user.bans) user.bans = [];
    if (!user.warns) user.warns = [];

    return user;
}
function getUserGlobal(logs, userId) {
    if (!logs[userId]) {
        logs[userId] = {
            totalPunishments: 0,
            mutes: [],
            notes: [],
            bans: [],
            warns: []
        };
    }

    const user = logs[userId];

    if (!user.mutes) user.mutes = [];
    if (!user.notes) user.notes = [];
    if (!user.bans) user.bans = [];
    if (!user.warns) user.warns = [];

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

//команды
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    getSettingsFile(chatId)
    loadSettings(chatId);
    getChatConfig(chatId)
    const settings = loadSettings(chatId);
    const config = getChatConfig(chatId) || DEFAULT_CONFIG
    
    if(lastcommand >= config.commandCd) {
        bot.sendMessage(chatId, 'Привет! Я Атри — лучший бот для модерации чата, ведь я — ПРОДВИНУТАЯ!', { reply_to_message_id: msg.message_id});
        bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW3Kpp2m3oeRAT7kSYyQYn50unC_LUcAACQk0AAgIrIUnHg1eVssvSCzsE', { reply_to_message_id: msg.message_id});
        lastcommand = 0;
    };
    
});
bot.onText(/\/commands/, async (msg) => {
    const chatId = msg.chat.id;
    getSettingsFile(chatId)
    loadSettings(chatId);
    getChatConfig(chatId)
    const settings = loadSettings(chatId);
    const config = getChatConfig(chatId) || DEFAULT_CONFIG
    if(lastcommand >= config.commandCd) {
                
        const userId = msg.from.id;

        try {
            const admins = await bot.getChatAdministrators(chatId);
            const isAdmin = admins.some(admin => admin.user.id === userId);
            if(isAdmin) {
                bot.sendMessage(chatId, 'Вот, что я умею: \n   <b>/settings</b> — открыть настройки чата, флаг -mc — отправить ответ в чат модерации (если настроен) \n   <b>/user</b> — узнать информацию о пользователе (ответом на его сообщение или вписав его Id после команды), флаг -f — узнать полную информацию о пользователе, флаг -mc — отправить ответ в чат модерации (если настроен) пример использования команды: /user 12345678910 -f -mc \n   <b>/note</b> — создать заметку о пользователе (ответом на сообщение или указав Id), пример использования команды: \note 12345678910 спамер, команда /unnote НОМЕР_ЗАМЕТКИ — удалить конкретную заметку о пользователе (ответом на сообщение или указав Id), номер заметки можно узнать в информации о пользователе \n   <b>/warn</b> — выдать пользователю предупреждение (ответом на его сообщение или указав его Id), можно указать причину предупреждения, флаг -d — бот удалит сообщение нарушителя (если команда написана ответом на него), флаг -i — предупреждение не исчезает со временем (если настроено время автоматического снятия предупреждений) пример использования команды: /warn 12345678910 Спам -d -i, команда /unwarn НОМЕР_ВАРНА (ответом на сообщение или указав Id) — снять конкретное предупреждение у пользователя, номер предупреждение можно посмотреть в полной информации о пользователе \n   <b>/mute</b> — запретить пользователю писать в чат (ответом на его сообщение или указав его Id), можно указать срок мута в минутах, часах, днях, месяцах буквами m,h,d,M соответственно (если время не указанно, то мут вечный), можно указать причину, флаг -d — бот удалит сообщение нарушителя (если команда написана ответом на него), пример использования команды: /mute 12345678910 5h Спам -d, команда /unwarn (ответом на сообщение или указав Id) — досрочно снять ограничения с пользователя \n   <b>/ban</b> — заблокировать пользователя в чате (ответом на его сообщение или указав его Id), можно указать срок бана в минутах, часах, днях, месяцах буквами m,h,d,M соответственно (если время не указанно, то бан вечный), можно указать причину, флаг -d — бот удалит сообщение нарушителя (если команда написана ответом на него), пример использования команды: /ban 12345678910 5h Спам -d, команда /unban (ответом на сообщение или указав Id) — досрочно разблокировать пользователя \n <b>/raidMode</b> —   включить режим активного антиспама и антирейда, подробнее можно узнать в настройках, команда /unRaidMode — отключить режим агрессивного антиспама и антирейда', {parse_mode: 'HTML', reply_to_message_id: msg.message_id})
            } else {
                bot.sendMessage(chatId, 'Вот, что я умею: \n   <b>/user</b> — узнать информацию о себе \n   <b>/report</b> — сообщить о нарушителе в чате (ответом на его сообщение) \n   <b>/help</b> — создать запрос в службу поддержки бота', {parse_mode: 'HTML', reply_to_message_id: msg.message_id})
            }
        } catch (error) {
            console.error(error, ' 1');
        }
        lastcommand = 0;
    };
    
});
bot.onText(/\/mute(?:\s+(.+))?/, async (msg,match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    getSettingsFile(chatId)
    loadSettings(chatId);
    getChatConfig(chatId)
    const settings = loadSettings(chatId);
    const config = getChatConfig(chatId) || DEFAULT_CONFIG
    if(lastcommand >= config.commandCd) {
        try {
            const admins = await bot.getChatAdministrators(chatId);
            const isAdmin = admins.some(admin => admin.user.id === userId);
            if(msg.chat.type === 'private') {
                bot.sendMessage(chatId, 'Я могу сделать это только в группе', { reply_to_message_id: msg.message_id})
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
                            return bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                                reply_to_message_id: msg.message_id
                            });
                        }

                        targetId = result.id;
                        args.shift();
                    }

                    if(targetId === null) {
                        return bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', { reply_to_message_id: msg.message_id})
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

                            bot.sendMessage(chatId, text, {
                                parse_mode: 'HTML',
                                reply_to_message_id: msg.message_id
                            });
                            const logs = loadLogs(chatId);
                            const userLog = getUser(logs, targetId);

                            userLog.totalPunishments++;

                            userLog.mutes.push({
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

                            saveLogs(chatId, logs);
                            pushGlobalLog(targetId, chatId, {
                            type: 'mute',
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
                        } catch (err) {
                            bot.sendMessage(chatId, 'Простите, я не смогла запретить этому пользователю писать в чат. Я правда пыталась, но что-то пошло не так', { reply_to_message_id: msg.message_id})
                            return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
                        }
                    } else {
                        bot.sendMessage(chatId, 'Я не могу наказать другого администратора', { reply_to_message_id: msg.message_id})
                    }
                } else {
                    bot.sendMessage(chatId, 'Похоже вы не обадаете правми администратора в этой группе', { reply_to_message_id: msg.message_id});
                    
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
    getSettingsFile(chatId)
    loadSettings(chatId);
    getChatConfig(chatId)
    const settings = loadSettings(chatId);
    const config = getChatConfig(chatId) || DEFAULT_CONFIG
    if(lastcommand >= config.commandCd) {
        if(msg.chat.type === 'private') {
            bot.sendMessage(chatId, 'Я могу сделать это только в группе', { reply_to_message_id: msg.message_id})
        } else {
            try {
                const admins = await bot.getChatAdministrators(chatId);
                const isAdmin = admins.some(admin => admin.user.id === userId);

                if (!isAdmin) {
                    return bot.sendMessage(chatId, 'Похоже вы не обадаете правми администратора в этой группе', {
                        reply_to_message_id: msg.message_id
                    });
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
                        return bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                            reply_to_message_id: msg.message_id
                        });
                    }

                    targetId = res.id;
                    args.shift();
                }

                await bot.restrictChatMember(chatId, targetId, {
                    can_send_messages: true,
                    can_send_media_messages: true,
                    can_send_polls: true,
                    can_send_other_messages: true,
                    can_add_web_page_previews: true
                });

                const target = await bot.getChatMember(chatId, targetId);
                const targetName = target.user.first_name;
                const mention = `<a href="tg://user?id=${targetId}">${targetName}</a>`;
                bot.sendMessage(chatId,
                    `Пользователь ${mention} снова может писать! С возвращением!`,
                    { parse_mode: 'HTML', reply_to_message_id: msg.message_id }
                );
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
                bot.sendMessage(chatId, 'Простите, я не смогла снять ограничения. Я правда пыталась, но что-то пошло не так', { reply_to_message_id: msg.message_id});
                bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
            }
            lastcommand = 0;
        }
        
    }
    
});
bot.onText(/\/kickme/, async (msg) => {
    const chatId = msg.chat.id;
    const admins = await bot.getChatAdministrators(chatId);
    const userId = msg.from.id;
    getSettingsFile(chatId)
    loadSettings(chatId);
    getChatConfig(chatId)
    const isAdmin = admins.some(admin => admin.user.id === userId);
    const settings = loadSettings(chatId);
    const config = getChatConfig(chatId) || DEFAULT_CONFIG
    if(lastcommand >= config.commandCd) {
        if(isAdmin) {
            return bot.sendMessage(chatId, 'От админства не так-то просто отделаться, страдай дальше', { reply_to_message_id: msg.message_id})
        } else {
            try {
                if(msg.chat.type === 'private') {
                bot.sendMessage(chatId, 'Я могу сделать это только в группе', { reply_to_message_id: msg.message_id})
            } else {
                bot.banChatMember(chatId, msg.from.id)
                bot.sendMessage(chatId, 'Пока-пока', { reply_to_message_id: msg.message_id})
                bot.unbanChatMember(chatId, msg.from.id)
            }
            } catch(e) {
                console.error(e)
                bot.sendMessage(chatId, 'Простите, я не смогла этого сделать. Я правда пыталась, но что-то пошло не так', { reply_to_message_id: msg.message_id})
                return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
        }
        }
        
    }
});
bot.onText(/\/ban(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    getSettingsFile(chatId)
    loadSettings(chatId);
    getChatConfig(chatId)
    const adminId = msg.from.id;
    const settings = loadSettings(chatId);
    const config = getChatConfig(chatId) || DEFAULT_CONFIG
    if(lastcommand >= config.commandCd) {
        if(msg.chat.type === 'private') {
            bot.sendMessage(chatId, 'Я могу сделать это только в группе', { reply_to_message_id: msg.message_id})
        } else {
            try {
                const admins = await bot.getChatAdministrators(chatId);
                const isAdmin = admins.some(a => a.user.id === adminId);

                if (!isAdmin) {
                    return bot.sendMessage(chatId, 'Похоже вы не обладаете правами администратора в этой группе', {
                        reply_to_message_id: msg.message_id
                    });
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
                        return bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                            reply_to_message_id: msg.message_id
                        });
                    }

                    targetId = res.id;
                    args.shift();
                }

                if (!targetId) {
                    return bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                        reply_to_message_id: msg.message_id
                    });
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
                    return bot.sendMessage(chatId, 'Я не могу наказать другого администратора', {
                        reply_to_message_id: msg.message_id
                    });
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

                await bot.sendMessage(chatId, text, {
                    parse_mode: 'HTML',
                    reply_to_message_id: msg.message_id
                });

                
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
                bot.sendMessage(chatId, 'Простите, я не смогла заблокировать этого пользователя. Я правда старалась, но что-то пошло не так', {
                    reply_to_message_id: msg.message_id
                });
                return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
            }
        }
    }       
    lastcommand = 0;
});
bot.onText(/\/unban(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    getSettingsFile(chatId)
    loadSettings(chatId);
    getChatConfig(chatId)
    const adminId = msg.from.id;
    const settings = loadSettings(chatId);
    const config = getChatConfig(chatId) || DEFAULT_CONFIG

    if(lastcommand >= config.commandCd) {
        try {
            const admins = await bot.getChatAdministrators(chatId);
            const isAdmin = admins.some(a => a.user.id === adminId);

            if (!isAdmin) {
                return bot.sendMessage(chatId, 'Похоже вы не обладаете правами администратора в этой группе', {
                    reply_to_message_id: msg.message_id
                });
            }

            let targetId = null;

            if (msg.reply_to_message) {
                targetId = msg.reply_to_message.from.id;
            } else {
                let args = (match[1] || '').trim().split(/\s+/).filter(Boolean);

                if (!args.length) {
                    return bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                        reply_to_message_id: msg.message_id
                    });
                }

                const entityMention = getUserFromEntities(msg);
                let input = entityMention || args[0];

                const res = await ResolveUser(bot, chatId, input);

                if (!res.ok) {
                    return bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                        reply_to_message_id: msg.message_id
                    });
                }

                targetId = res.id;
            }

            await bot.unbanChatMember(chatId, targetId);

            const member = await bot.getChatMember(chatId, targetId).catch(() => null);
            const name = member?.user?.first_name || 'User';
            const mention = `<a href="tg://user?id=${targetId}">${name}</a>`;

            await bot.sendMessage(chatId,
                `Пользователь ${mention} разблокирован. С возвращением!`,
                {
                    parse_mode: 'HTML',
                    reply_to_message_id: msg.message_id
                }
            );


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
            bot.sendMessage(chatId, 'Простите, я не смогла разблокировать пользователя. Я правда пыталась, но что-то пошло не так', {
                reply_to_message_id: msg.message_id
            });
            return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
        }
    }
    
});
bot.onText(/\/warn(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    getSettingsFile(chatId)
    loadSettings(chatId);
    getChatConfig(chatId)
    const adminId = msg.from.id;
    const settings = loadSettings(chatId);
    const config = getChatConfig(chatId) || DEFAULT_CONFIG
    if (lastcommand < config.commandCd) return;
    lastcommand = 0;

    if (msg.chat.type === 'private') {
        return bot.sendMessage(chatId, 'Я могу сделать это только в группе', { reply_to_message_id: msg.message_id });
    }
    
    try {
        const admins = await bot.getChatAdministrators(chatId);
        if (!admins.some(a => a.user.id === adminId)) {
            return bot.sendMessage(chatId, 'Похоже вы не обладаете правами администратора в этой группе', { reply_to_message_id: msg.message_id });
        }

        let args = (match[1] || '').split(/\s+/).filter(Boolean);

        let targetId = null;
        let reason = '';
        let deleteFlag = false;
        let ignoreExpire = false;

        if (msg.reply_to_message) {
            targetId = msg.reply_to_message.from.id;
        } else if (args.length) {
            const res = await ResolveUser(bot, chatId, args[0]);
            if (!res.ok) return bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', { reply_to_message_id: msg.message_id });

            targetId = res.id;
            args.shift();
        }

        if (!targetId) return;
        if (targetId)
        if (args.includes('-d')) {
            deleteFlag = true;
            args = args.filter(a => a !== '-d');
        }

        if (args.includes('-i')) {
            ignoreExpire = true;
            args = args.filter(a => a !== '-i');
        }

        reason = args.join(' ');
        const isTargetAdmin = admins.some(a => a.user.id === targetId);
        if (isTargetAdmin) {
            return bot.sendMessage(chatId, 'Я не могу наказать другого администратора', {
                reply_to_message_id: msg.message_id
            });
        }

        if (deleteFlag && msg.reply_to_message) {
            try { await bot.deleteMessage(chatId, msg.reply_to_message.message_id); } catch {}
        }
        const config = getChatConfig(chatId);
        const expireSeconds = ignoreExpire ? null : ParseDuration(config.WARN_EXPIRE);

        const warnEntry = {
            type: 'warn',
            active: true,
            issuedAt: new Date().toISOString(),
            messageText: msg.reply_to_message?.text || null,
            messageId: msg.reply_to_message?.message_id || null,
            reason,
            adminId,
            expiresAt: expireSeconds ? new Date(Date.now() + expireSeconds * 1000).toISOString() : null,
            removedAt: null,
            removedBy: null,
            ignoreExpire
        };

        const logs = loadLogs(chatId);
        const userLog = getUser(logs, targetId);

        userLog.totalPunishments++;
        userLog.warns.push(warnEntry);

        saveLogs(chatId, logs);

        const ulogs = loadUserLogs(targetId);
        const u = getUserGlobal(ulogs, targetId);

        u.totalPunishments++;
        u.warns.push({ ...warnEntry, chatId });

        saveUserLogs(targetId, ulogs);

        bot.sendMessage(chatId, `Я выдала предупреждение этиму пользователю`, { reply_to_message_id: msg.message_id });
        await checkWarnPunishment(chatId, targetId);
    } catch (e) {
        console.error(e);
        bot.sendMessage(chatId, 'Простите, я не смогла выдать предупреждение этому пользователю. Я правда пыталась, но что-то пошло не так', {reply_to_message_id: msg.message_id})
        return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
    }
});
bot.onText(/\/unwarn (\d+)(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    getSettingsFile(chatId)
    loadSettings(chatId);
    getChatConfig(chatId)
    const adminId = msg.from.id;
    const index = parseInt(match[1]) - 1;
    const settings = loadSettings(chatId);
    const config = getChatConfig(chatId) || DEFAULT_CONFIG
    if(lastcommand >= config.commandCd) {
        try {
            const admins = await bot.getChatAdministrators(chatId);
            if (!admins.some(a => a.user.id === adminId)) return;

            let args = (match[2] || '').split(/\s+/).filter(Boolean);

            let targetId = null;

            if (msg.reply_to_message) {
                targetId = msg.reply_to_message.from.id;
            } else if (args.length) {
                const res = await ResolveUser(bot, chatId, args[0]);
                if (!res.ok) return bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {reply_to_message_id: msg.message_id});
                targetId = res.id;
            }

            if (!targetId) return;

            const logs = loadLogs(chatId);
            const user = getUser(logs, targetId);

            if (!user.warns[index]) return;

            const warn = user.warns[index];
            warn.active = false;
            warn.removedAt = new Date().toISOString();
            warn.removedBy = adminId;

            saveLogs(chatId, logs);

            const ulogs = loadUserLogs(targetId);
            const u = getUserGlobal(ulogs, targetId);

            const globalWarn = u.warns.find(w =>
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

            bot.sendMessage(chatId, 'Я сняла это предупреждение у пользователя', { reply_to_message_id: msg.message_id });

        } catch (e) {
            console.error(e);
            bot.sendMessage(chatId, 'Простите, я не смогла снять это предупреждение у пользователя. Я правда очень старалась, но что-то пошло не так', {reply_to_message_id: msg.message_id})
            return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
        }
    }
    
});
bot.onText(/\/note(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    getSettingsFile(chatId)
    loadSettings(chatId);
    getChatConfig(chatId)
    const adminId = msg.from.id;
    const settings = loadSettings(chatId);
    const config = getChatConfig(chatId) || DEFAULT_CONFIG
    if(lastcommand >= config.commandCd) {
        if(msg.chat.type === 'private') {
            bot.sendMessage(chatId, 'Я могу сделать это только в группе', { reply_to_message_id: msg.message_id})
        }
        try {
            const admins = await bot.getChatAdministrators(chatId);
            const isAdmin = admins.some(a => a.user.id === adminId);

            if (!isAdmin) {
                return bot.sendMessage(chatId, 'Похоже вы не обадаете правми администратора в этой группе', { reply_to_message_id: msg.message_id});
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
                        return bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                            reply_to_message_id: msg.message_id
                        });
                    }

                    targetId = res.id;
                    args.shift();
                    text = args.join(' ');
                }
            if (!text) {
                return bot.sendMessage(chatId, 'Вы не сказали что мне следует записать о пользователе', { reply_to_message_id: msg.message_id});
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

            bot.sendMessage(chatId, 'Я всё записала!', {
                reply_to_message_id: msg.message_id
            });

        } catch (e) {
            console.error(e, '4');
            bot.sendMessage(chatId, 'Простите, я не смогла записать информацию о пользователе. Я правда пыталась, но что-то пошло не так', { reply_to_message_id: msg.message_id})
            return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
        }
        lastcommand = 0;
    }
    
});
bot.onText(/\/unnote (\d+)(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    getSettingsFile(chatId)
    loadSettings(chatId);
    getChatConfig(chatId)
    const adminId = msg.from.id;
    const index = parseInt(match[1]) - 1;
    const settings = loadSettings(chatId);
    const config = getChatConfig(chatId) || DEFAULT_CONFIG
    if(lastcommand >= config.commandCd) {
        try {
            const admins = await bot.getChatAdministrators(chatId);
            if (!admins.some(a => a.user.id === adminId)) return;

            let targetId = null;

            if (msg.reply_to_message) {
                    targetId = msg.reply_to_message.from.id;
                    userReply = true;
                } else if (args.length) {
                    const entityMention = getUserFromEntities(msg);
                    let input = entityMention || args[0];

                    const res = await ResolveUser(bot, chatId, input);
                    if (!res.ok) {
                        return bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                            reply_to_message_id: msg.message_id
                        });
                    }

                    targetId = res.id;
                    args.shift();
                }


            if (!targetId) return bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', { reply_to_message_id: msg.message_id});

            const logs = loadLogs(chatId);
            const user = getUser(logs, targetId);

            if (!user.notes[index]) {
                return bot.sendMessage(chatId, 'Я не смогла найти такую заметку у этого пользователя. Я проверила несколько раз, но такой заметк у него точно-точно нет', { reply_to_message_id: msg.message_id});
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

            bot.sendMessage(chatId, 'Я стёрла эту заметку', { reply_to_message_id: msg.message_id});

        } catch (e) {
            console.error(e, '5');
            bot.sendMessage(chatId, 'Простите, я не смогла стереть эту заметку у пользователя. Я правда пыталась, но что-то пошло не так', { reply_to_message_id: msg.message_id})
            return bot.sendSticker(chatId, 'CAACAgIAAxkBAAEW4xFp3TsFwtS0nT6OivaNRZQ8OmArcwACJVcAAtkTIUlsu94nV6R8wDsE', { reply_to_message_id: msg.message_id})
        }
        lastcommand = 0;
    }
    
});
bot.onText(/\/user(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    getSettingsFile(chatId)
    loadSettings(chatId);
    getChatConfig(chatId)
    const requesterId = msg.from.id;
    const settings = loadSettings(chatId);
    const config = getChatConfig(chatId) || DEFAULT_CONFIG

    if (lastcommand >= config.commandCd) {
        try {
            const admins = await bot.getChatAdministrators(chatId);
            const isAdmin = admins.some(a => a.user.id === requesterId);

            let args = (match[1] || '').trim().split(/\s+/).filter(Boolean);

            let showFull = args.includes('-f');
            let sendToModChat = args.includes('-mc');

            args = args.filter(a => a !== '-f' && a !== '-mc');

            let targetId = requesterId;

            
            if (msg.reply_to_message) {
                targetId = msg.reply_to_message.from.id;
            } else if (args.length) {
                const entityMention = getUserFromEntities(msg);
                let input = entityMention || args[0];

                const res = await ResolveUser(bot, chatId, input);
                if (!res.ok) {
                    return bot.sendMessage(chatId, 'Кажется я не знакома с этим пользователем', {
                        reply_to_message_id: msg.message_id
                    });
                }

                targetId = res.id;
            }

            
            if (!isAdmin) {
                const logs = loadLogs(chatId);
                const user = getUser(logs, requesterId);

                return bot.sendMessage(chatId,
                    `У вас предупреждений: ${user.warns?.length || 0}`,
                    { reply_to_message_id: msg.message_id }
                );
            }

            const logs = loadLogs(chatId);
            const user = getUser(logs, targetId);

            const member = await bot.getChatMember(chatId, targetId).catch(() => null);
            const name = member?.user?.first_name || 'Unknown';
            const mention = `<a href="tg://user?id=${targetId}">${name}</a>`;

            
            let targetChatId = chatId;

            if (sendToModChat) {
                if (config.modchatID) {
                    targetChatId = config.modchatID;
                } else {
                    return bot.sendMessage(chatId, 'Модераторский чат не настроен', {
                        reply_to_message_id: msg.message_id
                    });
                }
            }

            
            if (showFull) {
                const text =
                    `<b>Пользователь:</b> ${mention}\n\n` +
                    `Предупреждения: ${user.warns?.length || 0}\n` +
                    `Муты: ${user.mutes?.length || 0}\n` +
                    `Баны: ${user.bans?.length || 0}\n` +
                    `Заметки: ${user.notes?.length || 0}`;

                const markup = {
                    inline_keyboard: [
                        [{ text: 'Предупреждения', callback_data: 'user_type_warns' }],
                        [{ text: 'Муты', callback_data: 'user_type_mutes' }],
                        [{ text: 'Баны', callback_data: 'user_type_bans' }],
                        [{ text: 'Заметки', callback_data: 'user_type_notes' }]
                    ]
                };

                const sent = await bot.sendMessage(targetChatId, text, {
                    parse_mode: 'HTML',
                    reply_markup: markup
                });

                userViewState[requesterId] = {
                    adminId: requesterId,
                    chatId,
                    targetId,
                    baseText: text,
                    baseMarkup: markup,
                    messageId: sent.message_id
                };

                return;
            }

            
            let text = `<b>Пользователь:</b> ${mention}\n\n`;

            
            let mutes = user.mutes || [];
            mutes = mutes.filter(m => m.active);

            text += `<b>Муты (${mutes.length}):</b>\n`;

            mutes.forEach((m, i) => {
                text += `\n#${i + 1}\n`;
                text += `• Статус: ${m.active ? 'активен' : 'снят'}\n`;
                text += `• Дата: ${formatDateMSK(m.issuedAt)}\n`;
                if (m.reason) text += `• Причина: ${m.reason}\n`;
            });

            if (!mutes.length) text += `нет данных\n`;

            
            let notes = user.notes || [];
            notes = notes.filter(n => n.active);

            text += `\n<b>Заметки (${notes.length}):</b>\n`;

            notes.forEach((n, i) => {
                text += `\n#${i + 1} ${n.text}\n`;
            });

            if (!notes.length) text += `нет данных\n`;

            
            let bans = user.bans || [];
            bans = bans.filter(b => b.active);

            text += `\n<b>Баны (${bans.length}):</b>\n`;

            bans.forEach((b, i) => {
                text += `\n#${i + 1}\n`;
                text += `• Статус: ${b.active ? 'активен' : 'снят'}\n`;
                text += `• Дата: ${formatDateMSK(b.issuedAt)}\n`;
                if (b.reason) text += `• Причина: ${b.reason}\n`;
            });

            if (!bans.length) text += `нет данных\n`;

            
            let warns = user.warns || [];
            warns = warns.filter(w => w.active);

            text += `\n<b>Варны (${warns.length}):</b>\n`;

            warns.forEach((w, i) => {
                text += `\n#${i + 1}\n`;
                text += `• Статус: ${w.active ? 'активен' : 'снят'}\n`;
                text += `• Дата: ${formatDateMSK(w.issuedAt)}\n`;
                if (w.reason) text += `• Причина: ${w.reason}\n`;
            });

            if (!warns.length) text += `нет данных\n`;

            
            if (targetChatId !== chatId) {
                text = `<b>Запрос из чата ${chatId}</b>\n\n` + text;
            }

            const sendOptions = {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            };

            if (targetChatId === chatId) {
                sendOptions.reply_to_message_id = msg.message_id;
            }

            bot.sendMessage(targetChatId, text, sendOptions);

        } catch (err) {
            console.error(err, '6');
            bot.sendMessage(chatId,
                'Простите, я не смогла получить данные о пользователе. Я правда пыталась, но что-то пошло не так',
                { reply_to_message_id: msg.message_id }
            );
        }
    }

    lastcommand = 0;
});
bot.onText(/\/settings(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    getSettingsFile(chatId)
    loadSettings(chatId);
    getChatConfig(chatId)
    const userId = msg.from.id;
    const settings = loadSettings(chatId) || DEFAULT_CONFIG
    const config = getChatConfig(chatId) || DEFAULT_CONFIG

    if(lastcommand < config.commandCd) {return}
    if (!(await isAdmin(chatId, userId))) return;

    let args = (match[1] || '').split(/\s+/).filter(Boolean);

    const sendToModChat = args.includes('-mc');
    args = args.filter(a => a !== '-mc');

    
    let targetChat = chatId;

    if (sendToModChat) {
        if (!config.modchatID) {
            return bot.sendMessage(chatId, 'Модераторский чат не настроен');
        }
        targetChat = config.modchatID;
    }

    const text =
`<b>Настройки чата</b>

modchatID: ${settings.modchatID || 'не задан'}
commandCd: ${settings.commandCd}
WARN_EXPIRE: ${settings.WARN_EXPIRE}
WARN_LIMIT: ${settings.WARN_LIMIT}
WARN_PUNISHMENT: ${settings.WARN_PUNISHMENT}`;

    bot.sendMessage(targetChat, text, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Мод чат', callback_data: 'set_modchatID' }],
                [{ text: 'КД команд', callback_data: 'set_commandCd' }],
                [{ text: 'Время варнов', callback_data: 'set_WARN_EXPIRE' }],
                [{ text: 'Лимит варнов', callback_data: 'set_WARN_LIMIT' }],
                [{ text: 'Наказание', callback_data: 'set_WARN_PUNISHMENT' }]
            ]
        }
    });
});
bot.on('message', async (msg) => {
    const userId = msg.from.id;
    try {
        const admins = await bot.getChatAdministrators(chatId);
        return admins.some(a => a.user.id === userId);
    } catch {
        return false;
    }
    if (!waitingSettingsInput[userId]) return;

    const { chatId, key } = waitingSettingsInput[userId];

    const ok = await isAdmin(chatId, userId);
    if (!ok) {
        delete waitingSettingsInput[userId];
        return;
    }

    const settings = loadSettings(chatId);

    if (!(key in DEFAULT_SETTINGS)) {
        delete waitingSettingsInput[userId];
        return;
    }

    settings[key] = msg.text;

    saveSettings(chatId, settings);

    delete waitingSettingsInput[userId];

    bot.sendMessage(chatId, `Настройка ${key} обновлена: ${msg.text}`);
});
bot.onText(/\/settings\.set\.(\w+)\s+(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    getSettingsFile(chatId)
    loadSettings(chatId);
    getChatConfig(chatId)
    const key = match[1];
    const value = match[2];
    const settings = loadSettings(chatId);
    const config = getChatConfig(chatId) || DEFAULT_CONFIG
    if(lastcommand < config.commandCd) {return}
    if (!(await isAdmin(chatId, userId))) return;
    

    settings[key] = value;
    if (key === 'commandCd' || key === 'WARN_LIMIT') {
        settings[key] = parseInt(value);
    } else {
        settings[key] = value;
    }
    saveSettings(chatId, settings);

    bot.sendMessage(chatId, `Установлено: ${key} = ${value}`);
});
bot.onText(/\/settings\.remove\.(\w+)/, async (msg, match) => {
    const DEFAULT_SETTINGS = {
        modchatID: '',
        commandCd: 5,
        WARN_EXPIRE: '14d',
        WARN_LIMIT: 3,
        WARN_PUNISHMENT: 'mute 1M авто мут за варны'
    };
    const chatId = msg.chat.id;
    getSettingsFile(chatId)
    loadSettings(chatId);
    getChatConfig(chatId)
    const key = match[1];
    const userId = msg.from.id;
    const settings = loadSettings(chatId);
    const config = getChatConfig(chatId) || DEFAULT_CONFIG
    if(lastcommand < config.commandCd) {return}
    try {
        const admins = await bot.getChatAdministrators(chatId);
        const isAdmin = admins.some(admin => admin.user.id === userId);
    } catch (error) {
        console.error(error);
    }
    if(!isAdmin) {return}
    

    if (!(key in DEFAULT_SETTINGS)) {
        return bot.sendMessage(chatId, `Неизвестная настройка: ${key}`);
    }

    settings[key] = DEFAULT_SETTINGS[key];

    saveSettings(chatId, settings);

    bot.sendMessage(chatId, `Настройка ${key} сброшена до значения по умолчанию`);
});
bot.onText(/\/report/, async (msg) => {
    const chatId = msg.chat.id;
    getSettingsFile(chatId)
    loadSettings(chatId);
    getChatConfig(chatId)
    const settings = loadSettings(chatId);
    const config = getChatConfig(chatId) || DEFAULT_CONFIG
    
    if(lastcommand < config.commandCd) {return}
    if (!msg.reply_to_message) {
        return bot.sendMessage(chatId, 'Эту команду нужно использовать ответом на сообщение нарушителя', {
            reply_to_message_id: msg.message_id
        });
    }

    

    if (!config.modchatID) return;

    const reportedMsg = msg.reply_to_message;

    let text = reportedMsg.text || reportedMsg.caption || '[без текста]';

    if (text.length > 600) {
        text = text.slice(0, 600) + '...';
    }

    let link = '';
    try {
        if (msg.chat.type === 'supergroup') {
            const chatIdStr = String(chatId).replace('-100', '');
            link = `https://t.me/c/${chatIdStr}/${reportedMsg.message_id}`;
        }
    } catch {}

    const reporter = `<a href="tg://user?id=${msg.from.id}">${msg.from.first_name}</a>`;

    const target = `<a href="tg://user?id=${reportedMsg.from.id}">${reportedMsg.from.first_name}</a>`;

    let messageText =
        ` <b>Новый репорт</b>

        Репорт отправил: ${reporter}
        На пользователя: ${target}

        Сообщение:
        `;

    if (link) {
        messageText += `<a href="${link}">${text}</a>`;
    } else {
        messageText += text;
    }

    await bot.sendMessage(config.modchatID, messageText, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
    });

    bot.sendMessage(chatId, 'Я сообщила администрации о нарушителе', {
        reply_to_message_id: msg.message_id
    });
});
const waitingSettingsInput = {};




bot.on('callback_query', async (query) => {
    const data = query.data;
    const state = userViewState[query.from.id];

    if (!state) return;

    if (state.adminId !== query.from.id) {
        return bot.answerCallbackQuery(query.id, {
            text: 'Это меню не для вас',
            show_alert: true
        });
    }

    
    if (data === 'user_back_types') {
        return bot.editMessageText(state.baseText, {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: state.baseMarkup
        });
    }

    
    if (data.startsWith('user_type_')) {
        const type = data.split('_')[2];

        const logs = loadLogs(state.chatId);
        const user = getUser(logs, state.targetId);
        const items = user[type] || [];

        if (!items.length) {
            return bot.editMessageText('Нет данных', {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Назад', callback_data: 'user_back_types' }
                    ]]
                }
            });
        }

        return bot.editMessageText(`Выберите ${typeName(type)}:`, {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            reply_markup: buildPagedList(items, type, 0)
        });
    }

    
    if (data.startsWith('user_page_')) {
        const [, , type, pageStr] = data.split('_');
        const page = parseInt(pageStr);

        const logs = loadLogs(state.chatId);
        const user = getUser(logs, state.targetId);
        const items = user[type] || [];

        return bot.editMessageReplyMarkup(
            buildPagedList(items, type, page),
            {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id
            }
        );
    }

    
    if (data.startsWith('user_detail_')) {
        const [, , type, indexStr] = data.split('_');
        const index = parseInt(indexStr);

        const logs = loadLogs(state.chatId);
        const user = getUser(logs, state.targetId);
        const item = user[type][index];

        if (!item) return;

        let text = `<b>${typeName(type)} ${index + 1}</b>\n\n`;
        text += `Статус: ${item.active ? 'активен' : 'снят'}\n`;
        text += `Дата: ${formatDateMSK(item.issuedAt)}\n`;

        if (item.reason) text += `Причина: ${item.reason}\n`;
        if (item.expiresAt) text += `Истекает: ${formatDateMSK(item.expiresAt)}\n`;

        return bot.editMessageText(text, {
            parse_mode: 'HTML',
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            reply_markup: {
                inline_keyboard: [[
                    { text: 'Назад', callback_data: `user_type_${type}` }
                ]]
            }
        });
    }
});
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;


    const admins = await bot.getChatAdministrators(chatId);
    if (!admins.some(a => a.user.id === userId)) return bot.answerCallbackQuery(query.id, { text: 'Похоже вы не обладаете правами администратора в этом чате' });

    const key = query.data.replace('set_', '');

    waitingSettingsInput[userId] = {
        chatId,
        key
    };

    bot.sendMessage(chatId, `Введите новое значение для ${key}:`);
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
                    for (const warn of user.warns) {
                        if (!warn.active || !warn.expiresAt || warn.ignoreExpire) continue;

                        if (Date.now() >= new Date(warn.expiresAt).getTime()) {
                            warn.active = false;
                            warn.removedAt = new Date().toISOString();
                            warn.removedBy = 'system';

                            const ulogs = loadUserLogs(userId);
                            const u = getUserGlobal(ulogs, userId);

                            const globalWarn = u.warns.find(w =>
                                w.chatId == chatId &&
                                w.issuedAt === warn.issuedAt &&
                                w.active
                            );

                            if (globalWarn) {
                                globalWarn.active = false;
                                globalWarn.removedAt = new Date().toISOString();
                                globalWarn.removedBy = 'system';
                            }

                            saveUserLogs(userId, ulogs);
                            changed = true;
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

 /* проверка на админство внутри команды, команда должна быть async (msg)

    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        const admins = await bot.getChatAdministrators(chatId);
        const isAdmin = admins.some(admin => admin.user.id === userId);
    } catch (error) {
        console.error(error);
    }

*/
