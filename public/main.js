const socket = io();
let roomId;
let playerName;
let playerRole;
let flippedCards = [];
let startTime = null;
let endTime = null;

function showRoleSelection(action) {
  // 顯示角色選擇區域
  playerName = document.getElementById('player-name').value;
  // 獲取玩家輸入的名字
  if (!playerName) {
    // 如果玩家未輸入名字，顯示提示訊息並返回
    alert('請輸入你的名字');
    return;
  }
  document.getElementById('role-selection').style.display = 'block';
  // 顯示角色選擇區域
  document.getElementById('role-selection').dataset.action = action;
  // 將操作類型（創建或加入）保存到角色選擇區域的數據屬性中
}

function selectRole(role) {
  // 選擇角色（參加者或觀戰者）
  playerRole = role;
  // 設置玩家角色
  document.getElementById('role-selection').style.display = 'none';
  // 隱藏角色選擇區域
  const action = document.getElementById('role-selection').dataset.action;
  // 獲取操作類型（創建或加入）
  if (action === 'create') {
    // 如果操作類型是創建房間，調用createRoom函數
    createRoom();
  } else {
    // 如果操作類型是加入房間，調用joinRoom函數
    joinRoom();
  }
}


function createRoom() {
  // 創建房間函數
  const size = document.getElementById('board-size').value;
  // 獲取玩家選擇的棋盤大小
  if (size === '16') {
    // 如果選擇的棋盤大小是16（8x8）
    document.querySelector('.rules').style.display = 'none';
    // 隱藏遊戲規則
  } else {
    // 如果選擇的棋盤大小不是16
    document.querySelector('.rules').style.display = 'block';
    // 顯示遊戲規則
  }
  socket.emit('createRoom', { size, playerName, playerRole });
  // 通過Socket.IO向伺服器發送創建房間的請求，並傳遞棋盤大小、玩家名字和角色
}

socket.on('roomCreated', (id) => {
  // 當接收到伺服器發送的房間創建成功的訊息時，執行此回調函數
  roomId = id;
  // 設置房間ID
  document.getElementById('room-id').value = roomId;
  // 將房間ID顯示在輸入框中
  document.getElementById('game').style.display = 'block';
  // 顯示遊戲區域
  updateNotification(`房間已創建，房間 ID: ${roomId}`);
  // 更新通知欄，顯示房間已創建的訊息
});

function joinRoom() {
  // 加入房間函數
  roomId = document.getElementById('room-id').value;
  // 獲取玩家輸入的房間ID
  socket.emit('joinRoom', { roomId, playerName, playerRole });
  // 通過Socket.IO向伺服器發送加入房間的請求，並傳遞房間ID、玩家名字和角色
}


socket.on('board', (board) => {
  // 當接收到伺服器發送的棋盤信息時，執行此回調函數
  if (board.length === 256) {
    // 如果棋盤的長度是256（即8x8的棋盤）
    document.querySelector('.rules').style.display = 'none';
    // 隱藏遊戲規則
  } else {
    // 如果棋盤的長度不是256
    document.querySelector('.rules').style.display = 'block';
    // 顯示遊戲規則
  }
  initializeBoard(board);
  // 初始化並顯示棋盤
});

socket.on('roleFull', (message) => {
  // 當接收到伺服器發送的角色已滿訊息時，執行此回調函數
  document.getElementById('role-selection').style.display = 'none';
  // 隱藏角色選擇區域
  alert(message);
  // 顯示提示訊息，通知玩家角色已滿
});


socket.on('updatePlayers', (players) => {
  // 當接收到伺服器發送的玩家列表更新訊息時，執行此回調函數
  const playersList = document.getElementById('players');
  playersList.innerHTML = '';
  // 清空玩家列表的HTML內容
  players.forEach((player) => {
    // 遍歷所有玩家，將每個玩家的名字和角色添加到玩家列表中
    const playerItem = document.createElement('li');
    playerItem.textContent = `${player.name} (${player.role === 'spectator' ? '觀戰者' : '參加者'})`;
    // 判斷玩家角色，顯示“觀戰者”或“參加者”
    playersList.appendChild(playerItem);
    // 將玩家項目添加到玩家列表中
  });
  socket.emit('getCurrentPlayer', roomId);
  // 向伺服器發送請求，通知目前輪到的玩家
});

socket.on('playerJoined', (message) => {
  // 當接收到伺服器發送的有玩家加入的訊息時，執行此回調函數
  updateNotification(message);
  // 更新通知欄，顯示玩家加入的訊息
  socket.emit('getCurrentPlayer', roomId);
  // 向伺服器發送請求，通知目前輪到的玩家
});

socket.on('playerLeft', (message) => {
  // 當接收到伺服器發送的有玩家離開的訊息時，執行此回調函數
  updateNotification(message);
  // 更新通知欄，顯示玩家離開的訊息
  socket.emit('getCurrentPlayer', roomId);
  // 向伺服器發送請求，通知目前輪到的玩家
});

socket.on('nextPlayer', (nextPlayer) => {
  // 當接收到伺服器發送的輪到下一位玩家操作的訊息時，執行此回調函數
  updateNotification(`現在輪到 ${nextPlayer.name} 操作`);
  // 更新通知欄，顯示目前輪到的玩家
});


function flipCard(index) {
  // 翻牌函數，接收卡片的索引作為參數
  if (playerRole === 'spectator') {
    // 如果玩家角色是觀戰者
    alert('你不能去碰牌');
    // 提示觀戰者不能翻牌
    return;
    // 終止函數執行
  }
  if (!startTime) {
    // 如果遊戲尚未開始（即開始時間未設置）
    startTime = new Date();
    // 設置遊戲開始時間為當前時間
  }
  const card = document.getElementById(`card-${index}`);
  // 獲取要翻的卡片元素
  if (card.classList.contains('flipped') || card.classList.contains('removed') || flippedCards.length === 2) {
    // 如果卡片已經被翻開、被移除，或已有兩張卡片被翻開
    return;
    // 終止函數執行
  }
  socket.emit('flipCard', roomId, index);
  // 通過Socket.IO向伺服器發送翻牌請求，傳遞房間ID和卡片索引
}


socket.on('cardFlipped', (index, value) => {
  // 當接收到伺服器發送的翻牌訊息時，執行此回調函數
  const card = document.getElementById(`card-${index}`);
  // 獲取翻牌的HTML元素
  card.classList.add('flipped');
  // 將該卡片標記為已翻開
  card.textContent = value;
  // 顯示卡片的數值
  flippedCards.push({ index, value });
  // 將該卡片添加到已翻開卡片的數組中

  if (flippedCards.length === 2) {
    // 如果已翻開的卡片數量為兩張
    if (flippedCards[0].value === flippedCards[1].value) {
      // 如果兩張卡片的數值相同
      setTimeout(() => {
        // 延遲500毫秒以確保動畫完成
        socket.emit('pairFound', roomId, flippedCards[0].index, flippedCards[1].index);
        // 通過Socket.IO向伺服器發送配對成功的訊息，傳遞房間ID和兩張卡片的索引
        flippedCards = [];
        // 清空已翻開的卡片數組
        checkGameOver();
        // 檢查遊戲是否結束
      }, 500);
    } else {
      // 如果兩張卡片的數值不同
      setTimeout(() => {
        // 延遲500毫秒以確保動畫完成
        socket.emit('flipBack', roomId, flippedCards[0].index, flippedCards[1].index);
        // 通過Socket.IO向伺服器發送翻回卡片的訊息，傳遞房間ID和兩張卡片的索引
        flippedCards = [];
        // 清空已翻開的卡片數組
        socket.emit('nextPlayer', roomId);
        // 通過Socket.IO向伺服器發送下一位玩家的訊息
      }, 500);
    }
  }
});


socket.on('pairFound', (index1, index2) => {
  // 當接收到伺服器發送的配對成功訊息時，執行此回調函數
  const card1 = document.getElementById(`card-${index1}`);
  const card2 = document.getElementById(`card-${index2}`);
  // 獲取成功配對的兩張牌的HTML元素
  card1.classList.add('matched');
  card2.classList.add('matched');
  // 將這兩張牌標記為配對成功，添加'matched'類
  checkGameOver();
  // 檢查遊戲是否已經結束
});

socket.on('flipBack', (index1, index2) => {
  // 當接收到伺服器發送的翻回牌訊息時，執行此回調函數
  const card1 = document.getElementById(`card-${index1}`);
  const card2 = document.getElementById(`card-${index2}`);
  // 獲取需要翻回的兩張牌的HTML元素
  setTimeout(() => {
    card1.classList.remove('flipped');
    card1.textContent = '';
    card2.classList.remove('flipped');
    card2.textContent = '';
    // 延遲500毫秒以確保動畫完成後，將這兩張牌翻回，移除'flipped'類並清空牌面內容
    socket.emit('nextPlayer', roomId);
    // 向伺服器發送請求，通知輪到下一位玩家操作
  }, 500);
  // 延遲500毫秒以確保動畫完成
});


socket.on('gameOver', (scores) => {
  // 當接收到伺服器發送的遊戲結束訊息時，執行此回調函數
  setTimeout(() => {
    // 延遲500毫秒以確保動畫完成後顯示結束訊息
    if (startTime && !endTime) {
      // 如果遊戲開始時間已經記錄且結束時間尚未記錄
      endTime = new Date();
      // 記錄遊戲結束時間
      const elapsedTime = ((endTime - startTime) / 1000).toFixed(2);
      // 計算遊戲耗時，並將毫秒轉換為秒，保留兩位小數
      const playAgain = confirm(`遊戲結束! 最終得分:\n${scores.map(score => `${score.name}: ${score.score}\n`).join('')}\n用時: ${elapsedTime} 秒\n是否還要再玩一局?`);
      // 顯示對話框，提示玩家遊戲結束及最終得分，詢問玩家是否要再玩一局
      if (playAgain) {
        // 如果玩家選擇再玩一局
        resetGame();
        // 重置遊戲狀態
        socket.emit('restartGame', roomId);
        // 向伺服器發送重新開始遊戲的請求
      } else {
        // 如果玩家選擇不再玩一局
        socket.emit('leaveRoom', roomId);
        // 向伺服器發送離開房間的請求
        resetToInitialState();
        // 重置遊戲為初始狀態
        alert('你已離開房間');
        // 提示玩家已離開房間
      }
    } else {
      // 如果遊戲結束時間已經記錄
      const playAgain = confirm(`遊戲結束! 最終得分:\n${scores.map(score => `${score.name}: ${score.score}\n`).join('')}\n是否還要再玩一局?`);
      // 顯示對話框，提示玩家遊戲結束及最終得分，詢問玩家是否要再玩一局
      if (playAgain) {
        // 如果玩家選擇再玩一局
        resetGame();
        // 重置遊戲狀態
        socket.emit('restartGame', roomId);
        // 向伺服器發送重新開始遊戲的請求
      } else {
        // 如果玩家選擇不再玩一局
        socket.emit('leaveRoom', roomId);
        // 向伺服器發送離開房間的請求
        resetToInitialState();
        // 重置遊戲為初始狀態
        alert('你已離開房間');
        // 提示玩家已離開房間
      }
    }
  }, 500); // 確保動畫完成後顯示結束訊息
});

socket.on('roomClosed', () => { //通知玩家來開房間,並跳訊息給該玩家
  resetToInitialState();
  alert('你已離開房間');
});

function initializeBoard(board) {
  // 初始化遊戲板
  const boardElement = document.getElementById('board');
  boardElement.innerHTML = '';
  // 清空遊戲板的HTML內容
  const boardSize = Math.sqrt(board.length);
  // 計算棋盤的大小 (棋盤的邊長)
  boardElement.style.gridTemplateColumns = `repeat(${boardSize}, 70px)`;
  // 設置棋盤的CSS樣式，使其為boardSize x boardSize的網格佈局

  board.forEach((value, index) => {
    // 遍歷棋盤中的每一個值，創建對應的卡片元素
    const card = document.createElement('div');
    card.className = 'card';
    // 設置卡片的CSS類名
    card.id = `card-${index}`;
    // 設置卡片的ID，格式為'card-index'
    card.dataset.value = value;
    // 將卡片的值保存在data屬性中
    card.onclick = () => flipCard(index);
    // 當卡片被點擊時，調用flipCard函數
    boardElement.appendChild(card);
    // 將卡片元素添加到棋盤中
  });
}

function checkGameOver() {
  // 檢查遊戲是否結束
  const cards = document.querySelectorAll('.card');
  // 獲取所有的卡片元素
  const allMatched = Array.from(cards).every(card => card.classList.contains('matched'));
  // 檢查是否所有的卡片都已經配對成功 (都有'matched'類)
  if (allMatched) {
    // 如果所有卡片都已配對成功，遊戲結束
    socket.emit('gameOver', roomId);
    // 向伺服器發送遊戲結束的請求
  }
}

function resetGame() {
  // 重置遊戲狀態，準備開始新一局
  startTime = null;
  // 清空遊戲開始時間
  endTime = null;
  // 清空遊戲結束時間
  flippedCards = [];
  // 清空已翻開的卡片
}

function resetToInitialState() {
  // 重置遊戲到初始狀態
  document.getElementById('game').style.display = 'none';
  // 隱藏遊戲區域
  document.getElementById('room-id').value = '';
  // 清空房間ID輸入框
  document.getElementById('role-selection').style.display = 'none';
  // 隱藏角色選擇區域
  document.querySelector('.settings').style.display = 'block';
  // 顯示設置區域
  document.getElementById('player-name').value = '';
  // 清空玩家名稱輸入框
  document.getElementById('board-size').value = '2';
  // 將棋盤大小設置為默認值（2x2）
  clearBoard();
  // 清空遊戲板
  clearPlayerList();
  // 清空玩家列表
  clearNotifications();
  // 清空通知欄
}

function clearBoard() {
  // 清空遊戲板的內容
  const boardElement = document.getElementById('board');
  boardElement.innerHTML = '';
  // 清空遊戲板的HTML內容
}

function clearPlayerList() {
  // 清空玩家列表的內容
  const playersList = document.getElementById('players');
  playersList.innerHTML = '';
  // 清空玩家列表的HTML內容
}

function clearNotifications() {
  // 清空通知欄的內容
  const notificationsElement = document.getElementById('notifications');
  notificationsElement.innerHTML = '';
  // 清空通知欄的HTML內容
}


function clearBoard() {
  // 清空遊戲板的內容
  const boardElement = document.getElementById('board');
  // 獲取遊戲板的HTML元素
  boardElement.innerHTML = '';
  // 清空遊戲板的HTML內容
}

function clearPlayerList() {
  // 清空玩家列表的內容
  const playersList = document.getElementById('players');
  // 獲取玩家列表的HTML元素
  playersList.innerHTML = '';
  // 清空玩家列表的HTML內容
}


function clearNotifications() {
  // 清空通知欄的內容
  const notificationsElement = document.getElementById('notifications');
  // 獲取通知欄的HTML元素
  notificationsElement.innerHTML = '';
  // 清空通知欄的HTML內容
}

function updateNotification(message) {
  // 更新通知欄，顯示新的訊息
  const notificationsElement = document.getElementById('notifications');
  // 獲取通知欄的HTML元素
  notificationsElement.innerHTML = ''; 
  // 清空通知欄的HTML內容
  const notification = document.createElement('div');
  // 創建一個新的div元素，用於顯示新的通知訊息
  notification.textContent = message;
  // 設置div元素的文本內容為傳入的訊息
  notificationsElement.appendChild(notification);
  // 將新的通知元素添加到通知欄中
}

