const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

let rooms = {};

app.use(express.static('public'));
// 使用 Express 靜態中介軟體服務 'public' 資料夾中的靜態文件

io.on('connection', (socket) => {
  // 當有新的使用者連線時執行此回調函數
  console.log('使用者已連線');
  // 在控制台打印訊息，表示有新使用者連線

  socket.on('createRoom', ({ size, playerName, playerRole }) => {
    // 當接收到 'createRoom' 事件時，執行此回調函數
    const roomId = Math.random().toString(36).substr(2, 9);
    // 生成一個隨機的房間ID
    const boardSize = size || 2;
    // 如果未指定棋盤大小，則默認為2
    rooms[roomId] = {
      players: [],
      spectators: [],
      board: generateBoard(boardSize),
      currentPlayer: 0,
      scores: {},
      creator: socket.id
    };
    // 創建一個新的房間對象，包含玩家、觀戰者、棋盤、當前玩家、得分和創建者信息
    socket.join(roomId);
    // 讓使用者加入房間
    const player = { id: socket.id, name: playerName, role: playerRole };
    // 創建一個玩家對象，包含ID、名字和角色
    if (playerRole === 'participant') {
      rooms[roomId].players.push(player);
      // 如果玩家角色是參加者，將其添加到房間的玩家列表中
    } else {
      rooms[roomId].spectators.push(player);
      // 如果玩家角色是觀戰者，將其添加到房間的觀戰者列表中
    }
    rooms[roomId].scores[socket.id] = 0;
    // 初始化玩家的得分為0
    socket.emit('roomCreated', roomId);
    // 向創建房間的使用者發送房間已創建的事件和房間ID
    socket.emit('board', rooms[roomId].board);
    // 向創建房間的使用者發送棋盤信息
    io.to(roomId).emit('updatePlayers', rooms[roomId].players.concat(rooms[roomId].spectators));
    // 向房間內所有使用者發送玩家列表更新的事件
    io.to(roomId).emit('playerJoined', `${playerName}已進入房間`);
    // 向房間內所有使用者發送有玩家加入的事件和訊息
    if (playerRole === 'participant') {
      io.to(roomId).emit('nextPlayer', rooms[roomId].players[rooms[roomId].currentPlayer]);
      // 如果玩家角色是參加者，通知房間內所有使用者目前輪到的玩家
    }
  });


  socket.on('joinRoom', ({ roomId, playerName, playerRole }) => {
    // 當接收到 'joinRoom' 事件時，執行此回調函數
    if (rooms[roomId]) {
      // 如果房間存在
      const room = rooms[roomId];
      // 獲取該房間的詳細信息
      const playerCount = room.players.length;
      // 獲取房間中參加者的數量
      const spectatorCount = room.spectators.length;
      // 獲取房間中觀戰者的數量
  
      if (playerRole === 'participant' && playerCount >= 2) {
        // 如果玩家角色是參加者且參加者已滿
        socket.emit('roleFull', '參加者名額已滿');
        // 發送角色已滿的訊息給玩家
        return;
        // 終止函數執行
      }
      if (playerRole === 'spectator' && spectatorCount >= 2) {
        // 如果玩家角色是觀戰者且觀戰者已滿
        socket.emit('roleFull', '觀戰者名額已滿');
        // 發送角色已滿的訊息給玩家
        return;
        // 終止函數執行
      }
  
      socket.join(roomId);
      // 讓使用者加入房間
      const player = { id: socket.id, name: playerName, role: playerRole };
      // 創建一個玩家對象，包含ID、名字和角色
      if (playerRole === 'participant') {
        room.players.push(player);
        // 如果玩家角色是參加者，將其添加到房間的玩家列表中
      } else {
        room.spectators.push(player);
        // 如果玩家角色是觀戰者，將其添加到房間的觀戰者列表中
      }
      rooms[roomId].scores[socket.id] = 0;
      // 初始化玩家的得分為0
      io.to(roomId).emit('updatePlayers', room.players.concat(room.spectators));
      // 向房間內所有使用者發送玩家列表更新的事件
      socket.emit('board', room.board);
      // 向加入房間的使用者發送棋盤信息
      io.to(roomId).emit('playerJoined', `${playerName}已進入房間`);
      // 向房間內所有使用者發送有玩家加入的事件和訊息
      io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
      // 通知房間內所有使用者目前輪到的玩家
    } else {
      // 如果房間不存在
      socket.emit('error', '找不到房間');
      // 發送錯誤訊息給玩家
    }
  });
  

  socket.on('flipCard', (roomId, cardIndex) => {
    // 當接收到 'flipCard' 事件時，執行此回調函數
    if (rooms[roomId]) {
      // 如果房間存在
      const room = rooms[roomId];
      // 獲取該房間的詳細信息
      const player = room.players.find(p => p.id === socket.id);
      // 找到當前玩家的對象
  
      if (!player || player.role !== 'participant') {
        // 如果當前玩家不存在或玩家角色不是參加者
        socket.emit('error', '你不能去碰牌');
        // 發送錯誤訊息，提示玩家不能翻牌
        return;
        // 終止函數執行
      }
  
      if (room.currentPlayer !== room.players.indexOf(player)) {
        // 如果當前玩家不是輪到的玩家
        socket.emit('error', '不是你的回合');
        // 發送錯誤訊息，提示玩家不是他的回合
        return;
        // 終止函數執行
      }
  
      room.flippedCards = room.flippedCards || [];
      // 初始化房間的翻牌數組，如果不存在則設置為空數組
  
      if (room.flippedCards.length < 2) {
        // 如果當前翻開的卡片數量少於2
        room.flippedCards.push({ playerId: player.id, cardIndex });
        // 將翻開的卡片添加到數組中
        io.to(roomId).emit('cardFlipped', cardIndex, room.board[cardIndex]);
        // 通知房間內所有玩家該卡片已翻開
  
        if (room.flippedCards.length === 2) {
          // 如果當前翻開的卡片數量等於2
          const [firstCard, secondCard] = room.flippedCards;
          // 獲取兩張翻開的卡片
          if (room.board[firstCard.cardIndex] === room.board[secondCard.cardIndex]) {
            // 如果兩張卡片的值相同
            room.scores[player.id]++;
            // 增加玩家的得分
            io.to(roomId).emit('pairFound', firstCard.cardIndex, secondCard.cardIndex, player);
            // 通知房間內所有玩家找到一對相同的卡片
            room.flippedCards = [];
            // 清空翻開的卡片數組
            removeCards(room.board, firstCard.cardIndex, secondCard.cardIndex);
            // 從棋盤中移除這對卡片
            if (isGameOver(room.board)) {
              // 如果遊戲結束
              const finalScores = room.players.map(p => ({ name: p.name, score: room.scores[p.id] }));
              // 獲取所有玩家的最終得分
              io.to(roomId).emit('gameOver', finalScores);
              // 通知房間內所有玩家遊戲結束
            } else {
              // 如果遊戲未結束
              room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
              // 設置下一位玩家
              io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
              // 通知房間內所有玩家輪到下一位玩家操作
            }
          } else {
            // 如果兩張卡片的值不同
            setTimeout(() => {
              // 延遲一段時間後執行
              io.to(roomId).emit('flipBack', firstCard.cardIndex, secondCard.cardIndex);
              // 通知房間內所有玩家將兩張卡片翻回去
              room.flippedCards = [];
              // 清空翻開的卡片數組
              room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
              // 設置下一位玩家
              io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
              // 通知房間內所有玩家輪到下一位玩家操作
            }, 1000);
          }
        }
      }
    }
  });
  

  socket.on('restartGame', (roomId) => {
    // 當接收到 'restartGame' 事件時，執行此回調函數
    if (rooms[roomId]) {
      // 如果房間存在
      const room = rooms[roomId];
      // 獲取該房間的詳細信息
      room.board = generateBoard(Math.sqrt(room.board.length));
      // 重新生成棋盤，使用與原棋盤相同的大小
      room.currentPlayer = 0;
      // 重置當前玩家為第一位玩家
      room.scores = {};
      // 重置所有玩家的分數
      room.players.forEach(player => {
        room.scores[player.id] = 0;
        // 初始化每位玩家的分數為0
      });
      io.to(roomId).emit('board', room.board);
      // 發送新的棋盤狀態給房間內的所有玩家
      io.to(roomId).emit('updatePlayers', room.players.concat(room.spectators));
      // 更新房間內的玩家列表，發送給所有玩家
      io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
      // 通知房間內的所有玩家輪到的玩家
    }
  });
  

  socket.on('leaveRoom', (roomId) => {
    // 當接收到 'leaveRoom' 事件時，執行此回調函數
    if (rooms[roomId]) {
      // 如果房間存在
      const room = rooms[roomId];
      // 獲取該房間的詳細信息
      room.players = room.players.filter(player => player.id !== socket.id);
      // 將離開的玩家從玩家列表中移除
      room.spectators = room.spectators.filter(spectator => spectator.id !== socket.id);
      // 將離開的玩家從觀戰者列表中移除
      delete room.scores[socket.id];
      // 刪除離開玩家的分數記錄
  
      // 通知其他玩家
      io.to(roomId).emit('updatePlayers', room.players.concat(room.spectators));
      // 發送更新後的玩家列表給房間內的所有玩家
      io.to(roomId).emit('playerLeft', `${socket.id} 已離開房間`);
      // 發送玩家離開的訊息給房間內的所有玩家
  
      // 讓離開的玩家離開房間
      socket.leave(roomId);
      // 讓當前玩家離開房間
      socket.emit('roomClosed');
      // 通知離開的玩家房間已關閉
  
      // 如果房間沒有玩家，刪除房間
      if (room.players.length === 0 && room.spectators.length === 0) {
        delete rooms[roomId];
        // 如果房間中沒有任何玩家和觀戰者，刪除該房間
      } else {
        // 如果房間中還有其他玩家或觀戰者
        // 通知目前輪到的玩家
        io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
        // 通知房間內的所有玩家目前輪到的玩家
      }
    }
  });
  

  socket.on('disconnect', () => {
    // 當使用者斷線時，執行此回調函數
    console.log('使用者已斷線');
    // 在控制台打印訊息，表示有使用者斷線
  
    for (const roomId in rooms) {
      // 遍歷所有房間
      const room = rooms[roomId];
      // 獲取該房間的詳細信息
      const index = room.players.findIndex(p => p.id === socket.id);
      // 找到斷線的玩家在玩家列表中的索引
      if (index !== -1) {
        // 如果在玩家列表中找到斷線的玩家
        const player = room.players.splice(index, 1)[0];
        // 將斷線的玩家從玩家列表中移除
        delete room.scores[socket.id];
        // 刪除斷線玩家的分數記錄
        io.to(roomId).emit('updatePlayers', room.players.concat(room.spectators));
        // 發送更新後的玩家列表給房間內的所有玩家
        io.to(roomId).emit('playerLeft', `${player.name}已離開房間`);
        // 發送玩家離開的訊息給房間內的所有玩家
        if (room.players.length === 0 && room.spectators.length === 0) {
          delete rooms[roomId];
          // 如果房間中沒有任何玩家和觀戰者，刪除該房間
        } else {
          // 如果房間中還有其他玩家或觀戰者
          io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
          // 通知房間內的所有玩家目前輪到的玩家
        }
        break;
        // 終止遍歷其他房間
      }
  
      const spectatorIndex = room.spectators.findIndex(s => s.id === socket.id);
      // 找到斷線的觀戰者在觀戰者列表中的索引
      if (spectatorIndex !== -1) {
        // 如果在觀戰者列表中找到斷線的觀戰者
        const spectator = room.spectators.splice(spectatorIndex, 1)[0];
        // 將斷線的觀戰者從觀戰者列表中移除
        delete room.scores[socket.id];
        // 刪除斷線觀戰者的分數記錄
        io.to(roomId).emit('updatePlayers', room.players.concat(room.spectators));
        // 發送更新後的玩家列表給房間內的所有玩家
        io.to(roomId).emit('playerLeft', `${spectator.name}已離開房間`);
        // 發送觀戰者離開的訊息給房間內的所有玩家
        if (room.players.length === 0 && room.spectators.length === 0) {
          delete rooms[roomId];
          // 如果房間中沒有任何玩家和觀戰者，刪除該房間
        } else {
          // 如果房間中還有其他玩家或觀戰者
          io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
          // 通知房間內的所有玩家目前輪到的玩家
        }
        break;
        // 終止遍歷其他房間
      }
    }
  });
  

  socket.on('getCurrentPlayer', (roomId) => {
    // 當接收到 'getCurrentPlayer' 事件時，執行此回調函數
    if (rooms[roomId]) {
      // 如果房間存在
      const room = rooms[roomId];
      // 獲取該房間的詳細信息
      io.to(roomId).emit('nextPlayer', room.players[room.currentPlayer]);
      // 通知房間內的所有玩家目前輪到的玩家
    }
  });
});

server.listen(PORT, () => {
  // 啟動伺服器，監聽指定的端口
  console.log(`伺服器正在執行於端口 ${PORT}`);
  // 在控制台打印訊息，表示伺服器已啟動並正在監聽
});

function generateBoard(size) {
  // 生成遊戲棋盤的函數，接收棋盤大小作為參數
  const totalCards = size * size;
  // 計算總卡片數量
  const maxNumber = totalCards / 2;
  // 計算卡片的最大數值（每個數值會有兩張卡片）
  const cards = [];
  // 初始化卡片數組
  for (let i = 1; i <= maxNumber; i++) {
    // 將每個數值添加兩次到卡片數組中
    cards.push(i, i);
  }
  return shuffle(cards);
  // 將卡片數組隨機打亂並返回
}

function shuffle(array) {
  // 隨機打亂數組的函數，使用Fisher-Yates洗牌演算法
  for (let i = array.length - 1; i > 0; i--) {
    // 從數組的最後一個元素開始，依次向前
    const j = Math.floor(Math.random() * (i + 1));
    // 在數組中隨機選擇一個元素的索引
    [array[i], array[j]] = [array[j], array[i]];
    // 交換當前元素與隨機選擇的元素
  }
  return array;
  // 返回打亂後的數組
}

function removeCards(board, index1, index2) {
  // 從棋盤中移除兩張卡片的函數，接收棋盤和兩張卡片的索引作為參數
  board[index1] = null;
  // 將第一張卡片設置為null
  board[index2] = null;
  // 將第二張卡片設置為null
}

function isGameOver(board) {
  // 檢查遊戲是否結束的函數，接收棋盤作為參數
  return board.every(card => card === null);
  // 如果棋盤中的所有卡片都為null，則遊戲結束，返回true
}
