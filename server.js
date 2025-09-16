/*
 * WebSocket Chat Room Server
 * Author: Gemini AI & yqh
 * Date: 2025-09-16
 * Description: A Node.js WebSocket server supporting custom nicknames,
 * online user lists, typing indicators, and message broadcasting.
 */

const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

// 服务器配置
const PORT = 8080;

// 初始化 WebSocket 服务器
const wss = new WebSocket.Server({ port: PORT });

// 使用 Map 存储所有连接的客户端及其元数据
// Key: WebSocket instance (ws), Value: { id: string, username: string | null }
const clients = new Map();

/**
 * 检查昵称是否已被其他用户使用 (忽略大小写)
 * @param {string} nickname - 要检查的昵称
 * @returns {boolean} - 如果已被使用则返回 true，否则返回 false
 */
function isNicknameInUse(nickname) {
  for (const clientData of clients.values()) {
    if (
      clientData.username &&
      clientData.username.toLowerCase() === nickname.toLowerCase()
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 向所有连接的客户端广播消息
 * @param {object} payload - 要广播的JSON负载对象
 * @param {WebSocket} [senderWs] - (可选) 发送者，如果提供，则消息不会发送给此客户端
 */
function broadcast(payload, senderWs) {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    // 排除发送者（如果已提供）
    if (senderWs && client === senderWs) {
      return;
    }
    // 只向已准备好的客户端发送
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * 广播最新的在线用户列表给所有客户端
 */
function broadcastUserList() {
  const userList = Array.from(clients.values())
    .map((client) => client.username)
    .filter((username) => username); // 过滤掉值为 null 或 undefined 的用户名

  const payload = {
    type: "USER_LIST_UPDATE",
    users: userList.sort(), // 按字母顺序排序
  };
  broadcast(payload);
}

// 监听新的 WebSocket 连接
wss.on("connection", (ws) => {
  const clientId = uuidv4();
  ws.id = clientId;
  const metadata = { id: clientId, username: null }; // 初始用户名为 null
  clients.set(ws, metadata);

  console.log(`[Connection] 一个客户端连接成功, Client ID: ${clientId}`);

  // 监听来自该客户端的消息
  ws.on("message", (message) => {
    const messageString = message.toString();
    const senderInfo = clients.get(ws);

    try {
      const data = JSON.parse(messageString);

      switch (data.type) {
        case "SET_NICKNAME":
          const oldUsername = senderInfo.username;
          const newNickname = data.nickname ? data.nickname.trim() : "";

          // 验证昵称的有效性
          if (
            !newNickname ||
            newNickname.length < 2 ||
            newNickname.length > 15
          ) {
            ws.send(
              JSON.stringify({
                type: "SYSTEM",
                message: "错误: 昵称长度必须在2-15个字符之间。",
              })
            );
            return;
          }
          if (isNicknameInUse(newNickname)) {
            ws.send(
              JSON.stringify({
                type: "SYSTEM",
                message: `错误: 昵称 "${newNickname}" 已被占用，请换一个。`,
              })
            );
            return;
          }

          // 更新昵称
          senderInfo.username = newNickname;
          console.log(
            `[Nickname] Client ID ${ws.id} 设置昵称为 ${newNickname}`
          );

          // 发送欢迎消息给当前用户，并确认最终昵称
          ws.send(
            JSON.stringify({
              type: "SYSTEM",
              sender: "系统",
              message: `欢迎 ${newNickname} 来到聊天室！`,
              nickname: newNickname, // 将确认后的昵称发回，让客户端设置自己的名字
            })
          );

          // 广播系统消息和最新的用户列表
          const joinMessage = oldUsername
            ? `${oldUsername} 更名为 ${newNickname}`
            : `${newNickname} 加入了聊天室。`;
          broadcast({ type: "SYSTEM", message: joinMessage }, ws);
          broadcastUserList();
          break;

        case "CHAT":
          if (
            senderInfo.username &&
            typeof data.message === "string" &&
            data.message.trim() !== ""
          ) {
            broadcast(
              {
                type: "CHAT",
                sender: senderInfo.username,
                message: data.message.trim(),
              },
              ws
            );
          }
          break;

        case "TYPING_START":
        case "TYPING_STOP":
          if (senderInfo.username) {
            broadcast(
              {
                type: data.type,
                sender: senderInfo.username,
              },
              ws
            );
          }
          break;

        default:
          console.warn(`[Warning] 收到未知类型的消息: ${data.type}`);
      }
    } catch (error) {
      console.error(
        "[Error] 解析JSON失败或消息处理出错:",
        messageString,
        error
      );
    }
  });

  // 监听连接关闭事件
  ws.on("close", () => {
    const userInfo = clients.get(ws);
    clients.delete(ws); // 从 Map 中移除客户端

    if (userInfo && userInfo.username) {
      console.log(
        `[Disconnection] 用户 ${userInfo.username} (${ws.id}) 已断开连接。`
      );
      broadcast({
        type: "SYSTEM",
        sender: "系统",
        message: `${userInfo.username} 离开了聊天室。`,
      });
      broadcastUserList(); // 更新在线用户列表
    } else {
      console.log(
        `[Disconnection] 一个未设置昵称的客户端 (ID: ${ws.id}) 已断开连接。`
      );
    }
  });

  // 监听连接错误事件
  ws.on("error", (error) => {
    console.error(`[Error] 客户端 (ID: ${ws.id}) 发生错误:`, error);
  });
});

// 服务器启动成功日志
console.log(`✅ 聊天室 WebSocket 服务器正在运行于 ws://localhost:${PORT}`);
console.log(
  `   东京时间: ${new Date().toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
  })}`
);
