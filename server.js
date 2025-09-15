const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const wss = new WebSocket.Server({ port: 8080 });

const clients = new Map();

wss.on("connection", (ws) => {
  const clientId = uuidv4();
  ws.id = clientId;
  const metadata = { id: clientId, username: `匿名用户_${clientId.slice(-4)}` };
  clients.set(ws, metadata);

  console.log(`用户 ${metadata.username} (${clientId}) 连接成功。`);
  broadcastSystemMessage(`${metadata.username} 加入了聊天室。`);

  ws.on("message", (message) => {
    const messageString = message.toString();
    const senderInfo = clients.get(ws);

    try {
      const data = JSON.parse(messageString);
      switch (data.type) {
        case "CHAT":
          if (typeof data.message === "string") {
            console.log(
              `收到来自 ${senderInfo.username} 的聊天消息: ${data.message}`
            );
            broadcastChatMessage(ws, senderInfo.username, data.message);
          }
          break;
        case "TYPING_START":
        case "TYPING_STOP":
          console.log(
            `收到来自 ${senderInfo.username} 的状态消息: ${data.type}`
          );
          broadcastTypingState(ws, senderInfo.username, data.type);
          break;
        default:
          console.warn(`收到未知类型的消息: ${data.type}`);
      }
    } catch (error) {
      console.error("解析JSON失败或消息格式不正确:", messageString, error);
    }
  });

  ws.on("close", () => {
    const userInfo = clients.get(ws);
    if (userInfo) {
      console.log(`用户 ${userInfo.username} (${ws.id}) 已断开连接。`);
      broadcastSystemMessage(`${userInfo.username} 离开了聊天室。`);
      clients.delete(ws);
    }
  });

  const welcomePayload = JSON.stringify({
    type: "SYSTEM",
    sender: "系统",
    message: `欢迎 ${metadata.username} 来到聊天室！`,
  });
  ws.send(welcomePayload);
});

function broadcastSystemMessage(message) {
  const payload = JSON.stringify({
    type: "SYSTEM",
    sender: "系统",
    message,
  });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function broadcastChatMessage(senderWs, senderUsername, message) {
  const payload = JSON.stringify({
    type: "CHAT",
    sender: senderUsername,
    message: message,
  });
  wss.clients.forEach((client) => {
    if (client !== senderWs && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function broadcastTypingState(senderWs, senderUsername, type) {
  const payload = JSON.stringify({
    type: type,
    sender: senderUsername,
  });
  wss.clients.forEach((client) => {
    if (client !== senderWs && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

console.log("聊天室 WebSocket 服务器正在运行于 ws://localhost:8080");
