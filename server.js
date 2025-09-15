const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });

// 当有客户端连接时
wss.on("connection", (ws) => {
  console.log("一个新用户连接成功。");

  // 监听来自客户端的消息
  ws.on("message", (message) => {
    // 将收到的 Buffer 转换为字符串
    const messageString = message.toString();
    console.log("收到消息: %s", messageString);

    // *** 核心改动：广播消息给所有客户端 ***
    wss.clients.forEach((client) => {
      // 判断客户端是否处于连接状态，并且不是消息的发送者
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
  });

  // 监听连接关闭
  ws.on("close", () => {
    console.log("一个用户已断开连接。");
  });

  ws.send("欢迎来到聊天室！");
});

console.log("聊天室 WebSocket 服务器正在运行于 ws://localhost:8080");
