const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let gameData = {
    activeQuestion: null,
    firstAnswerer: null
};

io.on('connection', (socket) => {
    // Leader triggers a question from the main view
    socket.on('trigger-question', (data) => {
        gameData.activeQuestion = data;
        gameData.firstAnswerer = null;
        io.emit('show-quiz-overlay', data); 
    });

    // Player clicks an answer
    socket.on('submit-answer', (payload) => {
        if (!gameData.firstAnswerer) {
            gameData.firstAnswerer = payload.username;
            io.emit('reveal-results', {
                winner: payload.username,
                correctIndex: gameData.activeQuestion.correctIndex
            });
        }
    });
});

server.listen(3000, () => console.log('Server running on port 3000'));

