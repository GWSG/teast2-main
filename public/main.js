// 建立Socket.IO的連線
const socket = io();

// 定義變數來儲存房間ID、玩家名稱、玩家角色、翻轉的卡片以及遊戲開始和結束的時間
let roomId;
let playerName;
let playerRole;
let flippedCards = [];
let startTime = null;
let endTime = null;

// 顯示角色選擇區塊
function showRoleSelection(action) {
  // 取得玩家名稱
    playerName = document.getElementById('player-name').value;
    if (!playerName) {
      // 如果沒有輸入玩家名稱，則顯示提示訊息
        alert('請輸入你的名字');
        return;
    }
    // 顯示角色選擇區塊
    document.getElementById('role-selection').style.display = 'block';
    // 顯示角色選擇區塊
    document.getElementById('role-selection').dataset.action = action;
}

// 選擇角色
function selectRole(role) {
  // 設定玩家角色
    playerRole = role;
    // 隱藏角色選擇區塊
    document.getElementById('role-selection').style.display = 'none';
    // 根據先前的動作來創建或加入房間
    const action = document.getElementById('role-selection').dataset.action;
    if (action === 'create') {

        createRoom();
      
    } else {
      // 加入房間
        joinRoom();
    }
}

// 創建房間的函數
function createRoom() {
    // 取得棋盤大小的值
    const size = document.getElementById('board-size').value;
     // 根據棋盤大小來顯示或隱藏遊戲規則
    document.querySelector('.rules').style.display = (size === '16') ? 'none' : 'block';
    // 發送創建房間的請求給伺服器，包含棋盤大小、玩家名稱和玩家角色
    socket.emit('createRoom', { size, playerName, playerRole });
}

// 當伺服器創建房間成功後的回應
socket.on('roomCreated', (id) => {
   // 設定房間 ID
    roomId = id;
    // 在輸入框中顯示房間 ID
    document.getElementById('room-id').value = roomId;
    // 顯示遊戲區塊
    document.getElementById('game').style.display = 'block';
     // 更新通知欄，顯示房間已創建並顯示房間 ID
    updateNotification(`房間已創建，房間 ID: ${roomId}`);
});

// 加入房間的函數
function joinRoom() {
  // 取得房間 ID 和玩家名稱
    roomId = document.getElementById('room-id').value;
    playerName = document.getElementById('player-name').value;
    // 如果房間 ID 或玩家名稱未填寫，則顯示提示訊息
    if (!roomId || !playerName) {
        alert('請輸入房間 ID 和玩家名字');
        return;
    }
    // 發送加入房間的請求給伺服器，包含房間 ID、玩家名稱和玩家角色
    socket.emit('joinRoom', { roomId, playerName, playerRole });
}

// 當房間參加者或觀戰者名額已滿時，伺服器回應的處理函數
socket.on('roleFull', (message) => {
  // 顯示伺服器傳來的提示訊息
    alert(message);
});

// 當伺服器發送棋盤數據時的處理函數
socket.on('board', (board) => {
  // 根據棋盤大小來顯示或隱藏遊戲規則
    document.querySelector('.rules').style.display = (board.length === 256) ? 'none' : 'block';
     // 初始化棋盤
    initializeBoard(board);
    // 顯示遊戲區塊
    document.getElementById('game').style.display = 'block';
});

// 當伺服器發送更新玩家列表時的處理函數
socket.on('updatePlayers', (players) => {
  // 取得玩家列表的 DOM 元素
    const playersList = document.getElementById('players');
    // 清空玩家列表
    playersList.innerHTML = '';
    // 遍歷玩家數據，並將每個玩家的信息添加到列表中
    players.forEach((player) => {
        const playerItem = document.createElement('li');
        playerItem.textContent = `${player.name} (${player.role === 'spectator' ? '觀戰者' : '參加者'})`;
        playersList.appendChild(playerItem);
    });
    // 請求伺服器獲取當前操作的玩家
    socket.emit('getCurrentPlayer', roomId);
});

// 當有玩家加入房間時的處理函數
socket.on('playerJoined', (message) => {
  // 在控制台輸出玩家加入的消息
    console.log('Player joined:', message);
     // 更新通知欄
    updateNotification(message);
    // 請求伺服器獲取當前操作的玩家
    socket.emit('getCurrentPlayer', roomId);
});

// 當有玩家離開房間時的處理函數
socket.on('playerLeft', (message) => {
  // 在控制台輸出玩家離開的消息
    console.log('Player left:', message);
    // 更新通知欄
    updateNotification(message);
     // 請求伺服器獲取當前操作的玩家
    socket.emit('getCurrentPlayer', roomId);
});

// 當輪到下一位玩家操作時的處理函數
socket.on('nextPlayer', (nextPlayer) => {
  // 更新通知欄，顯示當前操作的玩家名稱
    updateNotification(`現在輪到 ${nextPlayer.name} 操作`);
});

// 當收到聊天訊息時的處理函數
socket.on('receiveMessage', ({ name, message }) => {
  // 在控制台輸出接收到的訊息
    console.log(`接收到訊息: ${name}: ${message}`);
     // 添加聊天訊息到聊天欄
    addChatMessage(`${name}: ${message}`);
});

// 初始化棋盤的函數
function initializeBoard(board) {
   // 取得棋盤的 DOM 元素
    const boardElement = document.getElementById('board');
    // 清空棋盤
    boardElement.innerHTML = '';
    // 計算棋盤的大小
    const boardSize = Math.sqrt(board.length);
    // 設定棋盤的樣式
    boardElement.style.gridTemplateColumns = `repeat(${boardSize}, 70px)`;

    // 遍歷棋盤數據，創建每個卡片的 DOM 元素並添加到棋盤
    board.forEach((value, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.id = `card-${index}`;
        card.dataset.value = value;
        card.onclick = () => flipCard(index);
        boardElement.appendChild(card);
    });
}

// 翻轉卡片的函數
function flipCard(index) {
  // 如果玩家是觀戰者，則顯示提示訊息
    if (playerRole === 'spectator') {
        alert('你不能去碰牌');
        return;
    }
    // 如果遊戲尚未開始，則記錄遊戲開始時間
    if (!startTime) {
        startTime = new Date();
    }
    // 取得要翻轉的卡片 DOM 元素
    const card = document.getElementById(`card-${index}`);
    // 如果卡片已翻轉、已移除或已經有兩張翻轉的卡片，則返回
    if (card.classList.contains('flipped') || card.classList.contains('removed') || flippedCards.length === 2) {
        return;
    }
    // 發送翻轉卡片的請求給伺服器
    socket.emit('flipCard', roomId, index);
}


// 當卡片被翻轉時的處理函數
socket.on('cardFlipped', (index, value) => {
   // 取得被翻轉的卡片 DOM 元素
    const card = document.getElementById(`card-${index}`);
    // 設置卡片為翻轉狀態，並顯示卡片的值
    card.classList.add('flipped');
    card.textContent = value;
    // 將翻轉的卡片添加到翻轉卡片的列表中
    flippedCards.push({ index, value });

    // 如果有兩張翻轉的卡片，則進行配對檢查
    if (flippedCards.length === 2) {
      // 設置一個延遲，以確保動畫完成後進行處理
        setTimeout(() => {
            if (flippedCards[0].value === flippedCards[1].value) {
              // 如果兩張卡片的值相同，則發送找到配對的請求給伺服器
                socket.emit('pairFound', roomId, flippedCards[0].index, flippedCards[1].index);
                // 清空翻轉卡片的列表
                flippedCards = [];
                // 檢查遊戲是否結束
                checkGameOver();
            } else {
              // 如果兩張卡片的值不同，則發送翻轉回去的請求給伺服器  
              socket.emit('flipBack', roomId, flippedCards[0].index, flippedCards[1].index);
              // 清空翻轉卡片的列表  
              flippedCards = [];
            }
        }, 500);
    }
});

// 當伺服器發送配對成功的訊息時的處理函數
socket.on('pairFound', (index1, index2) => {
  // 取得被配對成功的兩張卡片的 DOM 元素
    const card1 = document.getElementById(`card-${index1}`);
    const card2 = document.getElementById(`card-${index2}`);
    // 將卡片設置為配對成功的樣式
    card1.classList.add('matched');
    card2.classList.add('matched');
    // 檢查遊戲是否結束
    checkGameOver();
});

// 當伺服器發送卡片翻回去的訊息時的處理函數
socket.on('flipBack', (index1, index2) => {
  // 取得要翻回去的兩張卡片的 DOM 元素
    const card1 = document.getElementById(`card-${index1}`);
    const card2 = document.getElementById(`card-${index2}`);
   // 設置一個延遲，以確保動畫完成後進行處理
    setTimeout(() => {
      // 將卡片設置為未翻轉狀態，並清空顯示的值
        card1.classList.remove('flipped');
        card1.textContent = '';
        card2.classList.remove('flipped');
        card2.textContent = '';
        // 通知伺服器輪到下一位玩家操作
        socket.emit('nextPlayer', roomId);
    }, 500);
});

// 當伺服器發送遊戲結束的訊息時的處理函數
socket.on('gameOver', (scores) => {
  // 設置一個延遲，以確保動畫完成後進行處理
    setTimeout(() => {
      // 如果遊戲有開始並且尚未結束，計算遊戲用時
        if (startTime && !endTime) {
            endTime = new Date();
            const elapsedTime = ((endTime - startTime) / 1000).toFixed(2);
            // 顯示遊戲結束訊息並詢問是否重新開始遊戲
            if (confirm(`遊戲結束! 最終得分:\n${scores.map(score => `${score.name}: ${score.score}\n`).join('')}\n用時: ${elapsedTime} 秒\n是否還要再玩一局?`)) {
              // 重置遊戲並發送重新開始遊戲的請求給伺服器  
                resetGame();
                socket.emit('restartGame', roomId);
            } else {
              // 發送離開房間的請求給伺服器，並重置為初始狀態
                socket.emit('leaveRoom', roomId);
                resetToInitialState();
                alert('你已離開房間');
            }
        } else {
          // 如果遊戲沒有開始或已經結束，直接顯示遊戲結束訊息並詢問是否重新開始遊戲
            if (confirm(`遊戲結束! 最終得分:\n${scores.map(score => `${score.name}: ${score.score}\n`).join('')}\n是否還要再玩一局?`)) {
               // 重置遊戲並發送重新開始遊戲的請求給伺服器
                resetGame();
                socket.emit('restartGame', roomId);
            } else {
              // 發送離開房間的請求給伺服器，並重置為初始狀態
                socket.emit('leaveRoom', roomId);
                resetToInitialState();
                alert('你已離開房間');
            }
        }
    }, 500);
});

// 當伺服器發送房間關閉的訊息時的處理函數
socket.on('roomClosed', () => {
  // 重置為初始狀態
    resetToInitialState();
    alert('你已離開房間');
});

// 檢查遊戲是否結束的函數
function checkGameOver() {
  // 取得所有卡片的 DOM 元素
    const cards = document.querySelectorAll('.card');
    // 檢查是否所有卡片都已配對成功
    const allMatched = Array.from(cards).every(card => card.classList.contains('matched'));
    // 如果所有卡片都已配對成功，則發送遊戲結束的請求給伺服器
    if (allMatched) {
        socket.emit('gameOver', roomId);
    }
}

// 重置遊戲的函數
function resetGame() {
  // 重置遊戲開始和結束的時間
    startTime = null;
    endTime = null;
    // 清空翻轉卡片的列表
    flippedCards = [];
}

// 重置為初始狀態的函數
function resetToInitialState() {
   // 隱藏遊戲區塊
    document.getElementById('game').style.display = 'none';
  // 清空房間 ID 的輸入框
    document.getElementById('room-id').value = '';
    // 隱藏角色選擇區塊
    document.getElementById('role-selection').style.display = 'none';
    // 顯示設置區塊
    document.querySelector('.settings').style.display = 'block';
    // 清空玩家名稱的輸入框
    document.getElementById('player-name').value = '';
    // 將棋盤大小設置為默認值
    document.getElementById('board-size').value = '2';
    // 清空棋盤
    clearBoard();
    // 清空玩家列表
    clearPlayerList();
     // 清空通知欄
    clearNotifications();
    // 清空聊天欄
    clearChat();

}

// 清空棋盤的函數
function clearBoard() {
  // 取得棋盤的 DOM 元素
    const boardElement = document.getElementById('board');
    // 清空棋盤內容
    boardElement.innerHTML = '';
}

// 清空玩家列表的函數
function clearPlayerList() {
  // 取得玩家列表的 DOM 元素
    const playersList = document.getElementById('players');
    // 清空玩家列表內容
    playersList.innerHTML = '';
}

// 清空通知欄的函數
function clearNotifications() {
  // 取得通知欄的 DOM 元素
    const notificationsElement = document.getElementById('notifications');
    // 清空通知欄內容
    notificationsElement.innerHTML = '';
}

// 清空聊天欄的函數
function clearChat() {
  // 取得聊天欄的 DOM 元素
    const chatElement = document.getElementById('chat');
    // 清空聊天欄內容
    chatElement.innerHTML = '';
}

// 更新通知欄的函數
function updateNotification(message) {
   // 取得通知欄的 DOM 元素
    const notificationsElement = document.getElementById('notifications');
    // 清空通知欄內容
    notificationsElement.innerHTML = '';
    // 創建一個新的通知元素
    const notification = document.createElement('div');
    // 設置通知的文本內容
    notification.textContent = message;
     // 將通知元素添加到通知欄中
    notificationsElement.appendChild(notification);
}

// 添加聊天訊息的函數
function addChatMessage(message) {
  // 取得聊天欄的 DOM 元素
    const chatElement = document.getElementById('chat');
    // 創建一個新的聊天訊息元素
    const chatMessage = document.createElement('div');
    // 設置聊天訊息的文本內容
    chatMessage.textContent = message;
     // 將聊天訊息元素添加到聊天欄中
    chatElement.appendChild(chatMessage);
}


// 發送聊天訊息的函數
function sendMessage() {
  // 取得聊天輸入框的 DOM 元素
    const messageInput = document.getElementById('message-input');
    // 取得輸入框中的訊息
    const message = messageInput.value;
    // 如果有輸入訊息
    if (message) {
      // 發送訊息請求給伺服器，包含房間ID和訊息
        socket.emit('sendMessage', { roomId, message });
        // 清空輸入框內容
        messageInput.value = '';
    }
}

// 確保只註冊一次 'receiveMessage' 事件處理器
socket.off('receiveMessage').on('receiveMessage', ({ name, message }) => {
  // 添加接收到的聊天訊息到聊天欄
    addChatMessage(`${name}: ${message}`);
});