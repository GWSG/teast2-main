// 引入所需的模組
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// 創建 Express 應用
const app = express();
// 創建 HTTP 伺服器
const server = http.createServer(app);
// 使用 HTTP 伺服器創建 Socket.IO 伺服器
const io = socketIo(server);

// 設定伺服器監聽的端口號
const PORT = process.env.PORT || 3000;

// 存儲所有房間的資料
let rooms = {};

// 設置靜態檔案目錄
app.use(express.static('public'));

// 當有用戶連線時觸發的事件
io.on('connection', (socket) => {
    console.log('使用者已連線');

     // 當用戶創建房間時觸發的事件
    socket.on('createRoom', ({ size, playerName, playerRole }) => {
      // 生成隨機房間 ID
        const roomId = Math.random().toString(36).substr(2, 9);
        // 設定棋盤大小，預設為 2
        const boardSize = size || 2;
         // 創建房間並初始化房間數據
        rooms[roomId] = { players: [], spectators: [], board: generateBoard(boardSize), currentPlayer: 0, scores: {}, creator: socket.id };
        // 加入該房間
        socket.join(roomId);
        // 創建玩家數據
        const player = { id: socket.id, name: playerName, role: playerRole };
        // 根據玩家角色將玩家添加到參加者或觀戰者列表
        if (playerRole === 'participant') {
            rooms[roomId].players.push(player);
        } else {
            rooms[roomId].spectators.push(player);
        }
         // 初始化玩家分數
        rooms[roomId].scores[socket.id] = 0;
        // 向客戶端發送房間創建成功的訊息
        socket.emit('roomCreated', roomId);
        // 向客戶端發送棋盤數據
        socket.emit('board', rooms[roomId].board);
        // 向房間內所有用戶發送更新玩家列表的訊息
        io.to(roomId).emit('updatePlayers', rooms[roomId].players.concat(rooms[roomId].spectators));
        // 向房間內所有用戶發送玩家加入的訊息
        io.to(roomId).emit('playerJoined', `${playerName} 已進入房間 (${playerRole === 'spectator' ? '觀戰者' : '參加者'})`);
        // 如果是參加者，通知房間內的用戶誰是下一個操作的玩家
        if (playerRole === 'participant') {
            io.to(roomId).emit('nextPlayer', rooms[roomId].players[rooms[roomId].currentPlayer]);
        }
    });

    // 當用戶請求加入房間時觸發的事件
    socket.on('joinRoom', ({ roomId, playerName, playerRole }) => {
      // 在控制台輸出加入房間的請求訊息，包括房間ID、玩家名字和角色
        console.log(`加入房間請求: 房間ID: ${roomId}, 玩家名字: ${playerName}, 角色: ${playerRole}`);
        // 檢查房間是否存在
        if (rooms[roomId]) {
            const room = rooms[roomId];
            const playerCount = room.players.length;
            // 在控制台輸出當前房間的參加者數量
            console.log(`房間 ${roomId} 當前參加者數量: ${playerCount}`);


            // 如果房間參加者名額已滿，則發送錯誤訊息給客戶端並返回
            if (playerRole === 'participant' && playerCount >= 2) {
                socket.emit('roleFull', '參加者名額已滿');
                console.log('參加者名額已滿');
                return;
            }

             // 加入該房間
            socket.join(roomId);
            // 創建玩家數據
            const player = { id: socket.id, name: playerName, role: playerRole };
            // 根據玩家角色將玩家添加到參加者或觀戰者列表
            if (playerRole === 'participant') {
                room.players.push(player);
            } else {
                room.spectators.push(player);
            }
            // 初始化玩家分數
            rooms[roomId].scores[socket.id] = 0;

            // 確保新加入的玩家接收棋盤和玩家列表
            socket.emit('board', room.board); // 發送當前棋盤給新玩家
            io.to(roomId).emit('updatePlayers', room.players.concat(room.spectators)); // 更新玩家列表
            io.to(roomId).emit('playerJoined', `${playerName} 已進入房間 (${playerRole === 'spectator' ? '觀戰者' : '參加者'})`);

            // 通知目前輪到的玩家
            io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
        } else {
          // 如果房間不存在，則發送錯誤訊息給客戶端並在控制台輸出錯誤
            socket.emit('error', '找不到房間');
            console.log('找不到房間');
        }
    });

    // 當玩家請求翻轉卡片時觸發的事件
    socket.on('flipCard', (roomId, cardIndex) => {
      // 檢查房間是否存在
        if (rooms[roomId]) {
            const room = rooms[roomId];
            // 找到請求翻牌的玩家
            const player = room.players.find(p => p.id === socket.id);

            // 如果玩家不存在或角色不是參加者，則發送錯誤訊息
            if (!player || player.role !== 'participant') {
                socket.emit('error', '你不能去碰牌');
                return;
            }

            // 如果不是該玩家的回合，則發送錯誤訊息
            if (room.currentPlayer !== room.players.indexOf(player)) {
                socket.emit('error', '不是你的回合');
                return;
            }

            // 初始化翻轉卡片的列表
            room.flippedCards = room.flippedCards || [];

            // 如果翻轉的卡片數量少於 2 張
            if (room.flippedCards.length < 2) {
              // 將翻轉的卡片添加到列表中
                room.flippedCards.push({ playerId: player.id, cardIndex });
                // 廣播卡片被翻轉的訊息給房間內所有玩家
                io.to(roomId).emit('cardFlipped', cardIndex, room.board[cardIndex]);

                // 如果翻轉的卡片數量等於 2 張
                if (room.flippedCards.length === 2) {
                    const [firstCard, secondCard] = room.flippedCards;
                    // 如果兩張卡片匹配
                    if (room.board[firstCard.cardIndex] === room.board[secondCard.cardIndex]) {
                      // 增加玩家的分數
                        room.scores[player.id]++;
                        // 廣播配對成功的訊息給房間內所有玩家
                        io.to(roomId).emit('pairFound', firstCard.cardIndex, secondCard.cardIndex, player);
                        // 清空翻轉卡片的列表
                        room.flippedCards = [];
                        // 移除配對成功的卡片
                        removeCards(room.board, firstCard.cardIndex, secondCard.cardIndex);
                        // 檢查遊戲是否結束
                        if (isGameOver(room.board)) {
                          // 廣播遊戲結束的訊息給房間內所有玩家，並附上最終得分
                            const finalScores = room.players.map(p => ({ name: p.name, score: room.scores[p.id] }));
                            io.to(roomId).emit('gameOver', finalScores);
                        } else {
                          // 切換到下一位玩家
                            room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
                            io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
                        }
                    } else {
                       // 如果兩張卡片不匹配，設置延遲以確保動畫完成後翻回卡片
                        setTimeout(() => {
                          // 廣播翻轉回去的訊息給房間內所有玩家
                            io.to(roomId).emit('flipBack', firstCard.cardIndex, secondCard.cardIndex);
                             // 清空翻轉卡片的列表
                            room.flippedCards = [];
                            // 切換到下一位玩家
                            room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
                            io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
                        }, 1000);
                    }
                }
            }
        }
    });

    // 當玩家請求重新開始遊戲時觸發的事件
    socket.on('restartGame', (roomId) => {
      // 檢查房間是否存在
        if (rooms[roomId]) {
            const room = rooms[roomId];
            room.board = generateBoard(Math.sqrt(room.board.length)); // 重新生成棋盤
            room.currentPlayer = 0; // 重置當前玩家
            room.scores = {}; // 重置分數
            room.players.forEach(player => {
                room.scores[player.id] = 0; // 初始化玩家分數
            });
            io.to(roomId).emit('board', room.board); // 向房間內所有玩家發送新的棋盤狀態
            io.to(roomId).emit('updatePlayers', room.players.concat(room.spectators)); // 更新房間內的玩家列表
            io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]); // 通知房間內的玩家，下一個操作的玩家
        }
    });

    // 當玩家請求離開房間時觸發的事件
    socket.on('leaveRoom', (roomId) => {
      // 檢查房間是否存在
        if (rooms[roomId]) {
            const room = rooms[roomId];
            // 找到要離開房間的玩家
            const player = room.players.find(player => player.id === socket.id) || room.spectators.find(spectator => spectator.id === socket.id);
            if (player) {
              // 如果玩家是參加者，將其從參加者列表中移除
                if (player.role === 'participant') {
                    room.players = room.players.filter(p => p.id !== socket.id);
                } else {
                  // 如果玩家是觀戰者，將其從觀戰者列表中移除
                    room.spectators = room.spectators.filter(s => s.id !== socket.id);
                }
                 // 刪除玩家的分數
                delete room.scores[socket.id];

                // 通知其他玩家更新玩家列表
                io.to(roomId).emit('updatePlayers', room.players.concat(room.spectators));
                // 通知其他玩家有玩家離開房間
                io.to(roomId).emit('playerLeft', `${player.name} 已離開房間`);
                
                // 將該玩家從房間中移除
                socket.leave(roomId);
                // 通知該玩家房間已關閉
                socket.emit('roomClosed');

                // 如果房間沒有玩家，刪除房間
                if (room.players.length === 0 && room.spectators.length === 0) {
                    delete rooms[roomId];
                    console.log(`房間 ${roomId} 已刪除`);
                } else {
                    // 通知房間內的玩家，下一個操作的玩家
                    io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
                }
            }
        }
    });

    // 當玩家斷線時觸發的事件
    socket.on('disconnect', () => {
        console.log('使用者已斷線');
        // 遍歷所有房間
        for (const roomId in rooms) {
            const room = rooms[roomId];
            // 找到斷線的玩家
            const player = room.players.find(p => p.id === socket.id) || room.spectators.find(s => s.id === socket.id);
            if (player) {
              // 如果玩家是參加者，將其從參加者列表中移除
                if (player.role === 'participant') {
                    room.players = room.players.filter(p => p.id !== socket.id);
                } else {
                  // 如果玩家是觀戰者，將其從觀戰者列表中移除
                    room.spectators = room.spectators.filter(s => s.id !== socket.id);
                }
                 // 刪除玩家的分數
                delete room.scores[socket.id];
                 // 通知其他玩家更新玩家列表
                io.to(roomId).emit('updatePlayers', room.players.concat(room.spectators));
                // 通知其他玩家有玩家離開房間
                io.to(roomId).emit('playerLeft', `${player.name} 已離開房間`);
                 // 如果房間中已沒有玩家和觀戰者，則刪除房間
                if (room.players.length === 0 && room.spectators.length === 0) {
                    delete rooms[roomId];
                } else {
                  // 通知房間內的玩家，下一個操作的玩家
                    io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
                }
                break;
            }
        }
    });

    // 當客戶端請求當前玩家時觸發的事件
    socket.on('getCurrentPlayer', (roomId) => {
      // 檢查房間是否存在
        if (rooms[roomId]) {
            const room = rooms[roomId];
            // 通知房間內的玩家，當前操作的玩家
            io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
        }
    });

    // 當玩家發送訊息時觸發的事件
    socket.on('sendMessage', ({ roomId, message }) => {
      // 找到發送訊息的玩家
        const player = rooms[roomId].players.find(p => p.id === socket.id) || rooms[roomId].spectators.find(s => s.id === socket.id);
        if (player) {
          // 在控制台輸出收到的訊息
            console.log(`收到來自 ${player.name} 的訊息: ${message} (房間ID: ${roomId})`);
            // 廣播訊息給房間內的所有玩家
            io.to(roomId).emit('receiveMessage', { name: player.name, message });
        }
    });
});

// 伺服器開始監聽設定的端口
server.listen(PORT, () => {
    console.log(`伺服器正在執行於端口 ${PORT}`);
});


// 生成棋盤的函數
function generateBoard(size) {
  // 計算總卡片數量
    const totalCards = size * size;
    // 每個數字會有兩張卡片
    const maxNumber = totalCards / 2;
    // 用來存儲卡片的陣列
    const cards = [];
    // 生成成對的卡片
    for (let i = 1; i <= maxNumber; i++) {
        cards.push(i, i);
    }
    // 將卡片陣列隨機打亂
    return shuffle(cards);
}

// 隨機打亂陣列的函數
function shuffle(array) {
  // 使用現代版的 Fisher-Yates 洗牌演算法打亂陣列
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


// 移除配對成功的卡片的函數
function removeCards(board, index1, index2) {
    board[index1] = null;
    board[index2] = null;
}

// 檢查遊戲是否結束的函數
function isGameOver(board) {
  // 如果所有卡片都為 null，則遊戲結束
    return board.every(card => card === null);
}