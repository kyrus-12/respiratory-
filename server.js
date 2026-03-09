const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Track group states
const groups = {}; // { groupName: { members: [], selections: [], score: 0 } }
const groupSelections = {}; // { groupName: { questionIndex: [selectedIndices] } }

io.on('connection', (socket) => {
    console.log('New client connected');
    
    socket.on('user-join', (data) => {
        socket.username = data.username;
        socket.group = data.group;
        socket.role = data.role;
        
        if(data.role === 'player' && data.group) {
            // Join socket room for this group
            socket.join(data.group);
            
            // Initialize group if needed
            if(!groups[data.group]) {
                groups[data.group] = { members: [], score: 0 };
            }
            groups[data.group].members.push(data.username);
            
            // Notify all group members of count
            io.to(data.group).emit('group-members-update', 
                groups[data.group].members.length);
        }
    });
    
    socket.on('trigger-question', (quizData) => {
        // Reset group selections for new question
        Object.keys(groups).forEach(group => {
            groupSelections[group] = [];
        });
        
        // Broadcast to all clients
        io.emit('show-quiz-overlay', quizData);
    });
    
    socket.on('group-selection-attempt', (data) => {
        const { group, optionIndex, maxClicks, questionIndex } = data;
        
        // Initialize if needed
        if(!groupSelections[group]) groupSelections[group] = [];
        
        // Check if already selected
        if(groupSelections[group].includes(optionIndex)) return;
        
        // Check if max clicks reached
        if(groupSelections[group].length >= maxClicks) return;
        
        // Add selection
        groupSelections[group].push(optionIndex);
        
        // Broadcast to entire group (including sender)
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
        
        // Broadcast updated leaderboard to all
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
            io.to(data.group).emit('group-members-update', 
                groups[data.group].members.length);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});
