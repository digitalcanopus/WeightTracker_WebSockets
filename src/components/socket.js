const socket = new WebSocket('ws://localhost:3001');

socket.addEventListener('open', (event) => {
  console.log('Connected to server');
});

export default socket;