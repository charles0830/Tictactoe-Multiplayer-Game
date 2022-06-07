// import
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;
const Room = require('./models/room');

var server = http.createServer(app);


var io = require('socket.io').listen(server);

// middle ware
app.use(express.json());

const DB = 'MongoBD_CLUSTER_CONNECTION';

io.on('connection', (socket) => {
    console.log("connected");
    socket.on('createRoom', async ({ nickname }) => {
        console.log(nickname); 
        try{
            let room = new Room();
            let player = {
                socketID: socket.id,
                nickname,
                playerType: 'X',
            };
            room.players.push(player);
            room.turn = player;
            room = await room.save();
            console.log(room);
            const roomId = room._id.toString();
            socket.join(roomId);
            
            io.to(roomId).emit('createRoomSuccess', room);
        } catch (e) {
            console.log(e);
        }
    });

    socket.on("joinRoom", async ({ nickname, roomId }) => {
        try {
          if (!roomId.match(/^[0-9a-fA-F]{24}$/)) {
            socket.emit("errorOccurred", "Please enter a valid room ID.");
            return;
          }
          let room = await Room.findById(roomId);
    
          if (room.isJoin) {
            let player = {
              nickname,
              socketID: socket.id,
              playerType: "O",
            };
            socket.join(roomId);
            room.players.push(player);
            room.isJoin = false;
            room = await room.save();
            io.to(roomId).emit("joinRoomSuccess", room);
            io.to(roomId).emit("updatePlayers", room.players);
            io.to(roomId).emit("updateRoom", room);
          } else {
            socket.emit(
              "errorOccurred",
              "The game is in progress, try again later."
            );
          }
        } catch (e) {
          console.log(e);
        }
      });

      socket.on('tap', async ({index, roomId}) => {
        try {
          let room = await Room.findById(roomId);

          let choice = room.turn.playerType;
          if(room.turnIndex == 0) {
            room.turn = room.players[1];
            room.turnIndex = 1;
          } else {
            room.turn = room.players[0];
            room.turnIndex = 0;
          }
          room = await room.save();
          io.to(roomId).emit('tapped', {
            index,
            choice,
            room,
          })
        } catch (e) {
          console.log(e);
        }
      });

      socket.on("winner", async ({ winnerSocketId, roomId }) => {
        try {
          let room = await Room.findById(roomId);
          let player = room.players.find(
            (playerr) => playerr.socketID == winnerSocketId
          );
          player.points += 1;
          room = await room.save();
    
          if (player.points >= room.maxRounds) {
            io.to(roomId).emit("endGame", player);
          } else {
            io.to(roomId).emit("pointIncrease", player);
          }
        } catch (e) {
          console.log(e);
        }
      });
});

app.get('/', (req, res) => {
  res.send('Hello to souvenir API');
});

mongoose.connect(DB).then(() => {
    console.log('Connection Successful!');
}).catch((e) => {
    console.log(e);
});

server.listen(port, '0.0.0.0', () => {
    console.log(`server started and running on port ${port}`);
});
