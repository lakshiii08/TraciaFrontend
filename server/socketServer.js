const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || process.env.SOCKET_PORT || 3001;

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "TRACIA Socket.IO Server", timestamp: new Date().toISOString() }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("TRACIA Real-Time Socket.IO Server is operational.");
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let activeConnections = 0;

io.on("connection", (socket) => {
  activeConnections++;
  console.log(`[Socket.IO] Operator connected: ${socket.id} (Total active: ${activeConnections})`);

  // Broadcast case creation
  socket.on("case:create", (payload) => {
    console.log(`[Socket.IO] Case Created event received:`, payload?.id || "unknown");
    socket.broadcast.emit("case:created", payload);
  });

  // Broadcast case updates
  socket.on("case:update", (payload) => {
    console.log(`[Socket.IO] Case Updated event received:`, payload?.id || "unknown");
    socket.broadcast.emit("case:updated", payload);
  });

  // Broadcast FIR registrations
  socket.on("fir:register", (payload) => {
    console.log(`[Socket.IO] FIR Registered:`, payload?.firNumber || "unknown");
    socket.broadcast.emit("fir:registered", payload);
  });

  // Broadcast evidence uploads
  socket.on("evidence:upload", (payload) => {
    console.log(`[Socket.IO] Evidence Ingested:`, payload?.filename || "unknown");
    socket.broadcast.emit("evidence:uploaded", payload);
  });

  // Broadcast AI Pipeline progress
  socket.on("ai:step", (payload) => {
    socket.broadcast.emit("ai:step", payload);
  });

  // Broadcast Cyber Threat Alert
  socket.on("threat:alert", (payload) => {
    socket.broadcast.emit("threat:alert", payload);
  });

  socket.on("disconnect", (reason) => {
    activeConnections = Math.max(0, activeConnections - 1);
    console.log(`[Socket.IO] Operator disconnected: ${socket.id} (${reason}) (Total active: ${activeConnections})`);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 [TRACIA Real-Time Server] Socket.IO running on port ${PORT}`);
  console.log(`   Real-time events: case:create, fir:register, evidence:upload, ai:step`);
  console.log(`=======================================================`);
});

