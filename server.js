const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const wss = new WebSocket.Server({ port: 8080 });
const clients = new Map();

/**
 * 检查昵称是否已被其他用户使用
 * @param {string} nickname 要检查的昵称
 * @returns {boolean} 如果已被使用则返回 true，否则返回 false
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
 * @param {object} payload 要广播的JSON负载
 * @param {WebSocket} [senderWs] (可选) 发送者，如果提供，则不会向其广播
 */
function broadcast(payload, senderWs) {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client !== senderWs && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on("connection", (ws) => {
  const clientId = uuidv4();
  ws.id = clientId;
  // 连接时先分配一个临时的唯一ID作为名字，直到用户设置昵称
  const metadata = { id: clientId, username: null };
  clients.set(ws, metadata);

  console.log(`一个客户端连接成功, Client ID: ${clientId}`);

  ws.on("message", (message) => {
    const messageString = message.toString();
    const senderInfo = clients.get(ws);

    try {
      const data = JSON.parse(messageString);

      switch (data.type) {
        case "SET_NICKNAME":
          const oldUsername = senderInfo.username;
          const newNickname = data.nickname ? data.nickname.trim() : "";

          // 验证昵称
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
                message: `错误: 昵称 "${newNickname}" 已被使用。`,
              })
            );
            return;
          }

          senderInfo.username = newNickname;
          console.log(`Client ID ${ws.id} 设置昵称为 ${newNickname}`);

          // 发送欢迎消息给当前用户，并确认昵称
          ws.send(
            JSON.stringify({
              type: "SYSTEM",
              sender: "系统",
              message: `欢迎 ${newNickname} 来到聊天室！`,
              nickname: newNickname, // 把确认后的昵称发回去，让客户端设置自己的名字
            })
          );

          // 向所有人广播更名/加入的消息
          broadcast(
            {
              type: "SYSTEM",
              sender: "系统",
              message: `${newNickname} 加入了聊天室。`,
            },
            ws
          ); // 广播给除自己外的其他人
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
                message: data.message,
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
      }
    } catch (error) {
      console.error("解析JSON失败或消息处理出错:", messageString, error);
    }
  });

  ws.on("close", () => {
    const userInfo = clients.get(ws);
    if (userInfo && userInfo.username) {
      console.log(`用户 ${userInfo.username} (${ws.id}) 已断开连接。`);
      broadcast({
        type: "SYSTEM",
        sender: "系统",
        message: `${userInfo.username} 离开了聊天室。`,
      });
    } else {
      console.log(`一个未设置昵称的客户端 (ID: ${ws.id}) 已断开连接。`);
    }
    clients.delete(ws);
  });
});

console.log(
  `聊天室 WebSocket 服务器正在运行于 ws://localhost:8080 (东京时间: ${new Date().toLocaleTimeString(
    "ja-JP"
  )})`
);
