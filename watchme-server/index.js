const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');


const serverUrl = 'https://apiwatchme.randomatic.ir' // Update this with your server's URL (e.g., 'http://localhost:5000')
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: ['http://localhost:5173', 'http://192.168.67.62:5173', 'https://watchme.randomatic.ir'] },
});

app.use(cors());
app.use(bodyParser.json());
app.use('/streams', express.static(path.join(__dirname, 'streams')));
app.use(
    '/streams',
    (req, res, next) => {
        res.header('Access-Control-Allow-Origin', 'http://localhost:5173, http://192.168.67.62:5173', 'https://watchme.randomatic.ir');
        next();
    },
    express.static(path.join(__dirname, 'streams'))
);

// In-memory store for parties, socket-to-username mapping, and users.
let parties = {};
let socketToUserId = {};
let users = {}; // key: username, value: password

// Party management functions
const createParty = (partyId, leaderUsername, videoUrl) => {
    parties[partyId] = {
        leader: leaderUsername,
        members: [leaderUsername],
        videoUrl: videoUrl || null,
        currentTime: 0,
        isPlaying: false,
        streamReady: false,
        tokens: {},
    };
};

const joinParty = (partyId, username) => {
    if (parties[partyId]) {
        parties[partyId].members.push(username);
        return true;
    }
    return false;
};

const setVideoUrl = (partyId, leaderUsername, videoUrl) => {
    if (parties[partyId] && parties[partyId].leader === leaderUsername) {
        if (parties[partyId].videoUrl !== null) {
            // Video URL already set—do not allow changes.
            return false;
        }
        parties[partyId].videoUrl = videoUrl;
        parties[partyId].streamReady = false;
        return true;
    }
    return false;
};

const getOnlineUsers = (partyId) => {
    const sockets = io.sockets.adapter.rooms.get(partyId);
    return sockets ? Array.from(sockets).map(socketId => socketToUserId[socketId]).filter(Boolean) : [];
};

// API Endpoints
app.post('/api/create-party', (req, res) => {
    const { username, password, videoUrl } = req.body;
    if (users[username] && users[username] !== password) {
        return res.status(403).json({ success: false, message: 'Username already taken' });
    } else if (!users[username]) {
        users[username] = password;
    }
    const partyId = Math.random().toString(36).substring(7);
    const token = crypto.randomBytes(16).toString('hex');
    createParty(partyId, username, videoUrl);
    parties[partyId].tokens[username] = token;
    res.json({ partyId, token });
});

app.post('/api/join-party', (req, res) => {
    const { partyId, username, password } = req.body;
    if (users[username] && users[username] !== password) {
        return res.status(403).json({ success: false, message: 'Invalid credentials' });
    } else if (!users[username]) {
        users[username] = password;
    }
    if (joinParty(partyId, username)) {
        const token = crypto.randomBytes(16).toString('hex');
        if (!parties[partyId].tokens) parties[partyId].tokens = {};
        parties[partyId].tokens[username] = token;
        res.json({ success: true, token });
    } else {
        res.status(404).json({ success: false, message: 'Party not found' });
    }
});

app.post('/api/set-video', (req, res) => {
    const { partyId, username, videoUrl } = req.body;
    if (setVideoUrl(partyId, username, videoUrl)) {
        res.json({ success: true });
    } else {
        res.status(403).json({ success: false, message: 'Not authorized' });
    }
});

app.post('/api/start-stream', async (req, res) => {
    const { partyId, videoUrl } = req.body;
    if (parties[partyId]) {
        const outputDir = path.join(__dirname, 'streams', partyId);
        if (fs.existsSync(outputDir)) {
            try {
                fs.rmSync(outputDir, { recursive: true, force: true });
                console.log(`Removed previous stream folder for party ${partyId}`);
            } catch (err) {
                console.error('Error removing old stream folder:', err);
            }
        }
        fs.mkdirSync(outputDir, { recursive: true });
        const manifestPath = path.join(outputDir, 'stream.m3u8');
        const segmentFilename = path.join(outputDir, 'stream%03d.ts');

        ffmpeg(videoUrl)
            .outputOptions([
                '-preset veryfast',
                '-g 50',
                '-sc_threshold 0',
                '-hls_time 10',
                '-hls_list_size 0',
                '-hls_flags', 'independent_segments',
                '-hls_segment_filename', segmentFilename,
                '-f hls',
            ])
            .output(manifestPath)
            .on('start', () => {
                console.log('FFmpeg started');
            })
            .on('end', () => {
                console.log('Streaming ended');
            })
            .on('error', (err) => {
                console.error('FFmpeg error:', err);
                io.to(partyId).emit('streamError', 'Failed to generate stream');
            })
            .run();

        const maxWaitTime = 30000;
        const pollInterval = 1000;
        let elapsed = 0;

        while (elapsed < maxWaitTime) {
            if (fs.existsSync(manifestPath)) {
                const files = fs.readdirSync(outputDir);
                const segmentFiles = files.filter(f => f.match(/stream\d+\.ts/));
                if (segmentFiles.length > 0) {
                    parties[partyId].streamReady = true;
                    const streamUrl = `${serverUrl}/streams/${partyId}/stream.m3u8`;
                    io.to(partyId).emit('streamReady', streamUrl);
                    return res.json({ success: true, streamUrl });
                }
            }
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
            elapsed += pollInterval;
        }

        res.status(500).json({ success: false, message: 'Failed to start stream within time limit' });
    } else {
        res.status(404).json({ success: false, message: 'Party not found' });
    }
});

// WebSocket for synchronization and chat
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('authenticate', ({ username, partyId, token }) => {
        if (parties[partyId] && parties[partyId].tokens[username] === token) {
            socketToUserId[socket.id] = username;
            socket.join(partyId);
            // Save the partyId for this socket
            socket.partyId = partyId;
            console.log(`Socket ${socket.id} authenticated and joined party ${partyId}`);
            
            const party = parties[partyId];
            if (party.videoUrl) {
                socket.emit('videoSet', party.videoUrl);
            }
            if (party.streamReady) {
                const streamUrl = `${serverUrl}/streams/${partyId}/stream.m3u8`;
                socket.emit('streamReady', streamUrl);
            }
            socket.emit('sync', { time: party.currentTime, isPlaying: party.isPlaying });
            const onlineUsers = getOnlineUsers(partyId);
            io.to(partyId).emit('onlineUsers', { users: onlineUsers, leader: parties[partyId].leader });
        } else {
            socket.emit('authError', 'Invalid credentials');
            socket.disconnect();
        }
    });

    // Only allow these events after authentication
    ['play', 'pause', 'seek', 'sync', 'chatMessage'].forEach((event) => {
        socket.on(event, (data) => {
            const username = socketToUserId[socket.id];
            const partyId = data.partyId;
            if (!username || !parties[partyId]) return;

            if (event === 'chatMessage') {
                console.log(`Chat message from ${username} in party ${partyId}: ${data.message}`);
                socket.broadcast.to(partyId).emit('chatMessage', { userId: username, message: data.message, timestamp: Date.now() });
            } else if (parties[partyId].leader === username) {
                if (event === 'play') {
                    parties[partyId].isPlaying = true;
                    parties[partyId].currentTime = data.time;
                    socket.broadcast.to(partyId).emit('play', data.time);
                } else if (event === 'pause') {
                    parties[partyId].isPlaying = false;
                    parties[partyId].currentTime = data.time;
                    socket.broadcast.to(partyId).emit('pause', data.time);
                } else if (event === 'seek') {
                    parties[partyId].currentTime = data.time;
                    socket.broadcast.to(partyId).emit('seek', data.time);
                } else if (event === 'sync') {
                    parties[partyId].currentTime = data.time;
                    parties[partyId].isPlaying = data.isPlaying;
                    socket.broadcast.to(partyId).emit('sync', { time: data.time, isPlaying: data.isPlaying });
                }
            }
        });
    });

    socket.on('disconnect', () => {
        const username = socketToUserId[socket.id];
        const partyId = socket.partyId; // Retrieve the partyId from the socket object

        if (partyId && parties[partyId]) {
            // Check if the disconnecting user is the leader
            if (parties[partyId].leader === username) {
                parties[partyId].isPlaying = false;  // Pause the stream
                io.to(partyId).emit('pause', parties[partyId].currentTime);
            }

            // Broadcast updated list of online users
            const onlineUsers = getOnlineUsers(partyId);
            io.to(partyId).emit('onlineUsers', { users: onlineUsers.filter(user => user !== username), leader: parties[partyId].leader });

            // Ensure socket leaves the room
            socket.leave(partyId);
        }

        // Remove the socket from the user map
        delete socketToUserId[socket.id];
        delete socket.partyId;  // Clear the stored partyId for the socket

        console.log('Client disconnected:', socket.id);
    });
});

const PORT = 5002;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
