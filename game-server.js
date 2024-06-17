const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

let rooms = {};

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('使用者已連線');

    socket.on('createRoom', ({ size, playerName, playerRole }) => {
        const roomId = Math.random().toString(36).substr(2, 9);
        const boardSize = size || 2;
        rooms[roomId] = { players: [], spectators: [], board: generateBoard(boardSize), currentPlayer: 0, scores: {}, creator: socket.id };
        socket.join(roomId);
        const player = { id: socket.id, name: playerName, role: playerRole };
        if (playerRole === 'participant') {
            rooms[roomId].players.push(player);
        } else {
            rooms[roomId].spectators.push(player);
        }
        rooms[roomId].scores[socket.id] = 0;
        socket.emit('roomCreated', roomId);
        socket.emit('board', rooms[roomId].board);
        io.to(roomId).emit('updatePlayers', rooms[roomId].players.concat(rooms[roomId].spectators));
        io.to(roomId).emit('playerJoined', `${playerName} 已進入房間`);
        if (playerRole === 'participant') {
            io.to(roomId).emit('nextPlayer', rooms[roomId].players[rooms[roomId].currentPlayer]);
        }
    });

    socket.on('joinRoom', ({ roomId, playerName, playerRole }) => {
        if (rooms[roomId]) {
            const room = rooms[roomId];
            const playerCount = room.players.length;
            const spectatorCount = room.spectators.length;

            if (playerRole === 'participant' && playerCount >= 2) {
                socket.emit('roleFull', '參加者名額已滿');
                return;
            }
            if (playerRole === 'spectator' && spectatorCount >= 2) {
                socket.emit('roleFull', '觀戰者名額已滿');
                return;
            }

            socket.join(roomId);
            const player = { id: socket.id, name: playerName, role: playerRole };
            if (playerRole === 'participant') {
                room.players.push(player);
            } else {
                room.spectators.push(player);
            }
            rooms[roomId].scores[socket.id] = 0;

            // 確保新加入的玩家接收棋盤和玩家列表
            socket.emit('board', room.board); // 發送當前棋盤給新玩家
            io.to(roomId).emit('updatePlayers', room.players.concat(room.spectators)); // 更新玩家列表
            io.to(roomId).emit('playerJoined', `${playerName} 已進入房間`);

            // 通知目前輪到的玩家
            io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
        } else {
            socket.emit('error', '找不到房間');
        }
    });

    socket.on('flipCard', (roomId, cardIndex) => {
        if (rooms[roomId]) {
            const room = rooms[roomId];
            const player = room.players.find(p => p.id === socket.id);

            if (!player || player.role !== 'participant') {
                socket.emit('error', '你不能去碰牌');
                return;
            }

            if (room.currentPlayer !== room.players.indexOf(player)) {
                socket.emit('error', '不是你的回合');
                return;
            }

            room.flippedCards = room.flippedCards || [];

            if (room.flippedCards.length < 2) {
                room.flippedCards.push({ playerId: player.id, cardIndex });
                io.to(roomId).emit('cardFlipped', cardIndex, room.board[cardIndex]);

                if (room.flippedCards.length === 2) {
                    const [firstCard, secondCard] = room.flippedCards;
                    if (room.board[firstCard.cardIndex] === room.board[secondCard.cardIndex]) {
                        room.scores[player.id]++;
                        io.to(roomId).emit('pairFound', firstCard.cardIndex, secondCard.cardIndex, player);
                        room.flippedCards = [];
                        removeCards(room.board, firstCard.cardIndex, secondCard.cardIndex);
                        if (isGameOver(room.board)) {
                            const finalScores = room.players.map(p => ({ name: p.name, score: room.scores[p.id] }));
                            io.to(roomId).emit('gameOver', finalScores);
                        } else {
                            room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
                            io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
                        }
                    } else {
                        setTimeout(() => {
                            io.to(roomId).emit('flipBack', firstCard.cardIndex, secondCard.cardIndex);
                            room.flippedCards = [];
                            room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
                            io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
                        }, 1000);
                    }
                }
            }
        }
    });

    socket.on('restartGame', (roomId) => {
        if (rooms[roomId]) {
            const room = rooms[roomId];
            room.board = generateBoard(Math.sqrt(room.board.length)); // 重新生成棋盤
            room.currentPlayer = 0; // 重置當前玩家
            room.scores = {}; // 重置分數
            room.players.forEach(player => {
                room.scores[player.id] = 0; // 初始化玩家分數
            });
            io.to(roomId).emit('board', room.board); // 發送新的棋盤狀態
            io.to(roomId).emit('updatePlayers', room.players.concat(room.spectators)); // 更新房間內的玩家列表
            io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]); // 通知下一個玩家
        }
    });

    socket.on('leaveRoom', (roomId) => {
        if (rooms[roomId]) {
            const room = rooms[roomId];
            const player = room.players.find(player => player.id === socket.id) || room.spectators.find(spectator => spectator.id === socket.id);
            if (player) {
                if (player.role === 'participant') {
                    room.players = room.players.filter(p => p.id !== socket.id);
                } else {
                    room.spectators = room.spectators.filter(s => s.id !== socket.id);
                }
                delete room.scores[socket.id];

                // 通知其他玩家
                io.to(roomId).emit('updatePlayers', room.players.concat(room.spectators));
                io.to(roomId).emit('playerLeft', `${player.name} 已離開房間`);
                
                // 讓離開的玩家離開房間
                socket.leave(roomId);
                socket.emit('roomClosed');

                // 如果房間沒有玩家，刪除房間
                if (room.players.length === 0 && room.spectators.length === 0) {
                    delete rooms[roomId];
                } else {
                    // 通知目前輪到的玩家
                    io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
                }
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('使用者已斷線');
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const player = room.players.find(p => p.id === socket.id) || room.spectators.find(s => s.id === socket.id);
            if (player) {
                if (player.role === 'participant') {
                    room.players = room.players.filter(p => p.id !== socket.id);
                } else {
                    room.spectators = room.spectators.filter(s => s.id !== socket.id);
                }
                delete room.scores[socket.id];
                io.to(roomId).emit('updatePlayers', room.players.concat(room.spectators));
                io.to(roomId).emit('playerLeft', `${player.name} 已離開房間`);
                if (room.players.length === 0 && room.spectators.length === 0) {
                    delete rooms[roomId];
                } else {
                    io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
                }
                break;
            }
        }
    });

    socket.on('getCurrentPlayer', (roomId) => {
        if (rooms[roomId]) {
            const room = rooms[roomId];
            io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
        }
    });

    socket.on('sendMessage', ({ roomId, message }) => {
        const player = rooms[roomId].players.find(p => p.id === socket.id) || rooms[roomId].spectators.find(s => s.id === socket.id);
        if (player) {
            console.log(`收到來自 ${player.name} 的訊息: ${message} (房間ID: ${roomId})`);
            io.to(roomId).emit('receiveMessage', { name: player.name, message });
        }
    });
});

server.listen(PORT, () => {
    console.log(`伺服器正在執行於端口 ${PORT}`);
});

function generateBoard(size) {
    const totalCards = size * size;
    const maxNumber = totalCards / 2;
    const cards = [];
    for (let i = 1; i <= maxNumber; i++) {
        cards.push(i, i);
    }
    return shuffle(cards);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function removeCards(board, index1, index2) {
    board[index1] = null;
    board[index2] = null;
}

function isGameOver(board) {
    return board.every(card => card === null);
}
