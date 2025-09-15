const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const wss = new WebSocket.Server({ port: 8080 });

// 存储客户端信息，以ID为键
const clients = new Map();

// 客户端连接时
wss.on("connection", (ws) => {
  // uuid 生成唯一ID
  const clientId = uuidv4();
  // 添加一个id属性
  ws.id = clientId;

  // 处理键值对，并存入 Map
  const metadata = { id: clientId, username: `匿名用户_${clientId.slice(-4)}` };
  clients.set(ws, metadata);

  console.log(`用户 ${metadata.username} (${clientId}) 连接成功。`);

  // 广播新用户加入的消息
  broadcastSystemMessage(`${metadata.username} 加入了聊天室。`);

  // 监听来自客户端的消息
  ws.on("message", (message) => {
    const senderInfo = clients.get(ws); // 获取发送者的信息

    // 将收到的 Buffer 转换为字符串
    const messageString = message.toString();
    console.log("收到消息: %s", messageString);

    const payload = JSON.stringify({
      sender: senderInfo.username,
      message: messageString,
    });

    // 广播消息给所有客户端
    // console.log("客户端连接数：", wss.clients.size);
    wss.clients.forEach((client) => {
      //   console.log("客户端状态：", client.readyState);

      // 判断客户端是否处于连接状态，并且不是消息的发送者
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });

  // 监听连接关闭
  ws.on("close", () => {
    const { username } = clients.get(ws);
    console.log(`用户 ${username} (${ws.id}) 已断开连接。`);
    broadcastSystemMessage(`${username} 离开了聊天室。`);

    clients.delete(ws);
  });

  const welcomePayload = JSON.stringify({
    sender: "系统",
    message: `欢迎 ${metadata.username} 来到聊天室！`,
  });
  ws.send(welcomePayload);
});

// 广播系统消息的辅助函数
function broadcastSystemMessage(message) {
  const payload = JSON.stringify({ sender: "系统", message });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

console.log("聊天室 WebSocket 服务器正在运行于 ws://localhost:8080");
