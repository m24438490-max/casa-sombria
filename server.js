const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const players = {};
const monster = { x: 0, y: 0, z: -4 };
const SPAWN = { x: 0, y: 0, z: 18 };

io.on("connection", (socket) => {
  players[socket.id] = {
    id: socket.id,
    name: "Visitante",
    x: SPAWN.x,
    y: SPAWN.y,
    z: SPAWN.z,
    yaw: Math.PI
  };

  socket.emit("welcome", { id: socket.id, players, monster });
  socket.broadcast.emit("playerJoined", players[socket.id]);

  socket.on("setName", (name) => {
    if (!players[socket.id]) return;
    const clean = String(name || "Visitante").trim().slice(0, 16);
    players[socket.id].name = clean || "Visitante";
    io.emit("playerMoved", players[socket.id]);
  });

  socket.on("move", (data) => {
    const p = players[socket.id];
    if (!p || !data) return;

    // Limites básicos para impedir posições absurdas.
    p.x = Math.max(-22, Math.min(22, Number(data.x) || 0));
    p.z = Math.max(-22, Math.min(22, Number(data.z) || 0));
    p.yaw = Number(data.yaw) || 0;
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});

// Monstro compartilhado: persegue o jogador vivo mais próximo.
setInterval(() => {
  const active = Object.values(players);
  if (active.length) {
    let target = null;
    let best = Infinity;

    for (const p of active) {
      const d = Math.hypot(p.x - monster.x, p.z - monster.z);
      if (d < best) {
        best = d;
        target = p;
      }
    }

    if (target && best > 1.45) {
      const dx = target.x - monster.x;
      const dz = target.z - monster.z;
      const len = Math.hypot(dx, dz) || 1;
      const step = 0.075;
      monster.x += (dx / len) * step;
      monster.z += (dz / len) * step;
    }

    if (target && best <= 1.45) {
      const caughtId = target.id;
      target.x = SPAWN.x;
      target.z = SPAWN.z;
      io.to(caughtId).emit("caught");
    }
  }

  io.emit("world", { players, monster });
}, 50);

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Casa Sombria aberta em http://localhost:${PORT}`);
});