const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// ============================================
// MISSING: GROUP SCORES STORAGE - ADD THIS
// ============================================
let groupScores = {}; // Stores: { "Group 1": 50, "Group 2": 30 }

let gameData = {
    activeQuestion: null,
    firstAnswerer: null
};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // ============================================
    // MISSING: USER JOIN HANDLER - ADD THIS
    // ============================================
    socket.on('user-join', (data) => {
        socket.username = data.username;
        socket.group = data.group;
        socket.role = data.role;
        
        // Initialize group if doesn't exist
        if (data.group && !groupScores[data.group]) {
            groupScores[data.group] = 0;
        }
        
        // Send current leaderboard to new user
        socket.emit('update-leaderboard', groupScores);
        console.log(`${data.username} joined as ${data.role} in ${data.group || 'Admin'}`);
    });

    // Leader triggers a question from the main view
    socket.on('trigger-question', (data) => {
        gameData.activeQuestion = data;
        gameData.firstAnswerer = null;
        io.emit('show-quiz-overlay', data); 
    });

    // ============================================
    // MISSING: SCORE UPDATE HANDLER - ADD THIS
    // ============================================
    socket.on('score-update', (data) => {
        const { group, score, pointsAdded } = data;
        
        if (group && groupScores.hasOwnProperty(group)) {
            // Update the group's score
            groupScores[group] = score;
            
            // Broadcast updated leaderboard to ALL clients
            io.emit('update-leaderboard', groupScores);
            
            console.log(`Score updated: ${group} = ${score} (+${pointsAdded})`);
        }
    });

    // Player clicks an answer (legacy handler - keep for compatibility)
    socket.on('submit-answer', (payload) => {
        if (!gameData.firstAnswerer) {
            gameData.firstAnswerer = payload.username;
            io.emit('reveal-results', {
                winner: payload.username,
                correctIndex: gameData.activeQuestion.correctIndex
            });
        }
    });

    // ============================================
    // MISSING: CLOSE QUIZ HANDLER - ADD THIS
    // ============================================
    socket.on('close-quiz-manual', () => {
        io.emit('hide-quiz-overlay');
        console.log('Quiz closed by admin');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.username || socket.id);
    });
});

server.listen(3000, () => console.log('Server running on port 3000'));
