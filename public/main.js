const socket = io();
let roomId;
let playerName;
let playerRole;
let flippedCards = [];
let startTime = null;
let endTime = null;

function showRoleSelection(action) {
  playerName = document.getElementById('player-name').value;
  if (!playerName) {
    alert('請輸入你的名字');
    return;
  }
  document.getElementById('role-selection').style.display = 'block';
  document.getElementById('role-selection').dataset.action = action;
}

function selectRole(role) {
  playerRole = role;
  document.getElementById('role-selection').style.display = 'none';
  const action = document.getElementById('role-selection').dataset.action;
  if (action === 'create') {
    createRoom();
  } else {
    joinRoom();
  }
}

function createRoom() {
  const size = document.getElementById('board-size').value;
  socket.emit('createRoom', { size, playerName, playerRole });
}

socket.on('roomCreated', (id) => {
  roomId = id;
  document.getElementById('room-id').value = roomId;
  document.getElementById('game').style.display = 'block';
});

function joinRoom() {
  roomId = document.getElementById('room-id').value;
  socket.emit('joinRoom', { roomId, playerName, playerRole });
  document.getElementById('game').style.display = 'block';
}

socket.on('roleFull', (message) => {
  document.getElementById('role-selection').style.display = 'none';
  alert(message);
});

socket.on('updatePlayers', (players) => {
  const playersList = document.getElementById('players');
  playersList.innerHTML = '';
  players.forEach((player) => {
    const playerItem = document.createElement('li');
    playerItem.textContent = `${player.name} (${player.role === 'spectator' ? '觀戰者' : '參加者'})`;
    playersList.appendChild(playerItem);
  });
});

function flipCard(index) {
  if (playerRole === 'spectator') {
    alert('你不能去碰牌');
    return;
  }
  if (!startTime) {
    startTime = new Date();
  }
  const card = document.getElementById(`card-${index}`);
  if (card.classList.contains('flipped') || card.classList.contains('removed') || flippedCards.length === 2) {
    return;
  }
  socket.emit('flipCard', roomId, index);
}

socket.on('cardFlipped', (index, value) => {
  const card = document.getElementById(`card-${index}`);
  card.classList.add('flipped');
  card.textContent = value;
  flippedCards.push({ index, value });

  if (flippedCards.length === 2) {
    if (flippedCards[0].value === flippedCards[1].value) {
      setTimeout(() => {
        socket.emit('pairFound', roomId, flippedCards[0].index, flippedCards[1].index);
        flippedCards = [];
        checkGameOver();
      }, 500); // 延遲以確保動畫完成
    } else {
      setTimeout(() => {
        socket.emit('flipBack', roomId, flippedCards[0].index, flippedCards[1].index);
        flippedCards = [];
        socket.emit('nextPlayer', roomId);
      }, 500); // 延遲以確保動畫完成
    }
  }
});

socket.on('pairFound', (index1, index2) => {
  const card1 = document.getElementById(`card-${index1}`);
  const card2 = document.getElementById(`card-${index2}`);
  card1.classList.add('matched');
  card2.classList.add('matched');
  checkGameOver();
});

socket.on('flipBack', (index1, index2) => {
  const card1 = document.getElementById(`card-${index1}`);
  const card2 = document.getElementById(`card-${index2}`);
  setTimeout(() => {
    card1.classList.remove('flipped');
    card1.textContent = '';
    card2.classList.remove('flipped');
    card2.textContent = '';
    socket.emit('nextPlayer', roomId);
  }, 500);
});

socket.on('nextPlayer', (nextPlayer) => {
  console.log(`下一個玩家是: ${nextPlayer.name}`);
});

socket.on('gameOver', (scores) => {
  setTimeout(() => {
    if (startTime && !endTime) {
      endTime = new Date();
      const elapsedTime = ((endTime - startTime) / 1000).toFixed(2);
      const playAgain = confirm(`遊戲結束! 最終得分:\n${scores.map(score => `${score.name}: ${score.score}\n`).join('')}\n用時: ${elapsedTime} 秒\n是否還要再玩一局?`);
      if (playAgain) {
        resetGame();
        socket.emit('restartGame', roomId);
      } else {
        // 發送退出房間請求
        socket.emit('leaveRoom', roomId);
      }
    } else {
      const playAgain = confirm(`遊戲結束! 最終得分:\n${scores.map(score => `${score.name}: ${score.score}\n`).join('')}\n是否還要再玩一局?`);
      if (playAgain) {
        resetGame();
        socket.emit('restartGame', roomId);
      } else {
        // 發送退出房間請求
        socket.emit('leaveRoom', roomId);
      }
    }
  }, 500); // 確保動畫完成後顯示結束訊息
});

socket.on('roomClosed', () => {
  document.getElementById('game').style.display = 'none';
  document.getElementById('room-id').value = '';
  resetGame();
  alert('你已離開房間');
});

socket.on('playerJoined', (message) => {
  console.log(message); // 記錄玩家加入訊息
});

function initializeBoard(board) {
  const boardElement = document.getElementById('board');
  boardElement.innerHTML = '';
  const boardSize = Math.sqrt(board.length);
  boardElement.style.gridTemplateColumns = `repeat(${boardSize}, 70px)`;

  board.forEach((value, index) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `card-${index}`;
    card.dataset.value = value;
    card.onclick = () => flipCard(index);
    boardElement.appendChild(card);
  });
}

socket.on('board', (board) => {
  initializeBoard(board);
});

function checkGameOver() {
  const cards = document.querySelectorAll('.card');
  const allMatched = Array.from(cards).every(card => card.classList.contains('matched'));
  if (allMatched) {
    socket.emit('gameOver', roomId);
  }
}

function resetGame() {
  startTime = null;
  endTime = null;
  flippedCards = [];
}
