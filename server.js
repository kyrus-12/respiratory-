const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path'); // Added for file path handling

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// --- 1. SERVE YOUR FILES (The Fix for "Cannot GET /") ---
// This tells Express to serve all files in your current folder
app.use(express.static(__dirname)); 

// This tells Express exactly what to send when someone visits "/"
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- 2. SOCKET.IO LOGIC ---
const groups = {}; 
const groupSelections = {}; 

io.on('connection', (socket) => {
    console.log('New client connected: ' + socket.id);
    
    socket.on('user-join', (data) => {
        socket.username = data.username;
        socket.group = data.group;
        socket.role = data.role;
        
        if(data.role === 'player' && data.group) {
            socket.join(data.group);
            
            if(!groups[data.group]) {
                groups[data.group] = { members: [], score: 0 };
            }
            // Avoid duplicate names in the member list
            if (!groups[data.group].members.includes(data.username)) {
                groups[data.group].members.push(data.username);
            }
            
            io.to(data.group).emit('group-members-update', groups[data.group].members.length);
        }
    });
    
    socket.on('trigger-question', (quizData) => {
        // Reset group selections for new question
        Object.keys(groups).forEach(group => {
            groupSelections[group] = [];
        });
        io.emit('show-quiz-overlay', quizData);
    });
    
    socket.on('group-selection-attempt', (data) => {
        const { group, optionIndex, maxClicks } = data;
        if(!groupSelections[group]) groupSelections[group] = [];
        if(groupSelections[group].includes(optionIndex)) return;
        if(groupSelections[group].length >= maxClicks) return;
        
        groupSelections[group].push(optionIndex);
        
        io.to(group).emit('group-selection-update', {
            optionIndex: optionIndex,
            selectionsSoFar: groupSelections[group],
            maxClicks: maxClicks,
            selector: socket.username
        });
    });
    
    socket.on('score-update', (data) => {
        if(groups[data.group]) {
            groups[data.group].score = data.score;
        }
        
        const leaderboard = {};
        Object.keys(groups).forEach(g => {
            leaderboard[g] = groups[g].score;
        });
        io.emit('update-leaderboard', leaderboard);
    });
    
    socket.on('close-quiz-manual', () => {
        io.emit('hide-quiz-overlay');
    });
    
    socket.on('user-leave', (data) => {
        if(data.group && groups[data.group]) {
            groups[data.group].members = groups[data.group].members
                .filter(m => m !== data.username);
            io.to(data.group).emit('group-members-update', groups[data.group].members.length);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// --- 3. START SERVER ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
