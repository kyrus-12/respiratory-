const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname)); 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

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
            if (!groups[data.group].members.includes(data.username)) {
                groups[data.group].members.push(data.username);
            }
            io.to(data.group).emit('group-members-update', groups[data.group].members.length);
        }
    });
    
    socket.on('trigger-question', (quizData) => {
        // Clear all selections for the new round
        for (let g in groupSelections) delete groupSelections[g];
        io.emit('show-quiz-overlay', quizData);
    });

    // --- NEW: GLOBAL STOP HANDLER ---
    // This catches the signal from index.html and broadcasts it to EVERYONE
    socket.on('trigger-global-stop', () => {
        console.log("Global Stop Triggered by " + socket.group);
        io.emit('receive-global-stop'); 
    });
    
    socket.on('group-selection-attempt', (data) => {
        const { group, optionIndex, maxClicks } = data;
        if(!groupSelections[group]) groupSelections[group] = [];
        
        // Safety check to prevent clicking the same button twice
        if(groupSelections[group].includes(optionIndex)) return;
        if(groupSelections[group].length >= maxClicks) return;
        
        groupSelections[group].push(optionIndex);
        
        // Notify only the group members about the selection
        io.to(group).emit('group-selection-update', {
            optionIndex: optionIndex,
            selectionsSoFar: groupSelections[group],
            maxClicks: maxClicks,
            selector: socket.username
        });

        // --- NEW: AUTO-STOP IF ALL GROUPS FINISHED (Optional) ---
        // If you want the timer to stop only when EVERY single group has finished, 
        // you would add logic here to compare groupSelections.length with total groups.
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
