import React, { useEffect, useRef, useState, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import '@videojs/http-streaming';
import axios from 'axios';
import io from 'socket.io-client';
import { PartyContext } from '../context/PartyContext';
import ChatInput from './ChatInput.jsx';
import { config } from '../config.js';

// Define your custom emojis
const customEmojis = config.customEmojis;

// Simple debounce function
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

const SYNC_THRESHOLD = 1;
const SYNC_INTERVAL = 2000;

const PartyRoom = () => {
    const { partyId: contextPartyId, userId, isLeader, setPartyId } = useContext(PartyContext);
    const { partyId: urlPartyId } = useParams();

    useEffect(() => {
        if (!contextPartyId && urlPartyId) {
            setPartyId(urlPartyId);
        }
    }, [contextPartyId, urlPartyId, setPartyId]);

    const navigate = useNavigate();
    const videoRef = useRef(null);
    const playerRef = useRef(null);
    const socket = useRef(null);
    const [videoUrl, setVideoUrl] = useState('');
    const [streamUrl, setStreamUrl] = useState('');
    const [isStreamReady, setIsStreamReady] = useState(false);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const isSeekingFromServer = useRef(false);
    const latestSyncState = useRef(null);

    const [onlineUsers, setOnlineUsers] = useState([]);
    const [leader, setLeader] = useState('');
    const [showUserList, setShowUserList] = useState(false);

    const [chatMessages, setChatMessages] = useState([]);
    const chatMessagesRef = useRef(null);
    const chatSidebarRef = useRef(null);
    const [isChatVisible, setIsChatVisible] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    // Video.js and socket setup (unchanged)
    useEffect(() => {
        if (!videoRef.current || playerRef.current) return;
        const timeoutId = setTimeout(() => {
            const player = videojs(videoRef.current, {
                controls: true,
                autoplay: false,
                fluid: true,
                sources: [],
            });
            player.on('ready', () => {
                console.log('Player is ready');
                setIsPlayerReady(true);
                if (latestSyncState.current) {
                    const { time, isPlaying } = latestSyncState.current;
                    player.currentTime(time);
                    isPlaying ? player.play() : player.pause();
                    latestSyncState.current = null;
                }
            });
            player.on('error', () => {
                console.error('Video.js error:', player.error());
            });
            playerRef.current = player;
        }, 0);
        return () => {
            clearTimeout(timeoutId);
            if (playerRef.current) {
                playerRef.current.dispose();
                playerRef.current = null;
                setIsPlayerReady(false);
            }
        };
    }, [isLeader]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        socket.current = io(config.host);
        socket.current.emit('authenticate', { username: userId, partyId: contextPartyId || urlPartyId, token });
        socket.current.on('authError', (message) => {
            alert(message);
            navigate('/');
        });
        socket.current.on('onlineUsers', ({ users, leader }) => {
            setOnlineUsers(users);
            setLeader(leader);
        });
        
        const player = playerRef.current;
        if (player && isPlayerReady) {
            if (isLeader) {
                player.on('play', () => {
                    socket.current.emit('play', { partyId: contextPartyId || urlPartyId, time: player.currentTime() });
                });
                player.on('pause', () => {
                    socket.current.emit('pause', { partyId: contextPartyId || urlPartyId, time: player.currentTime() });
                });
                const handleSeek = debounce(() => {
                    if (!isSeekingFromServer.current) {
                        socket.current.emit('seek', { partyId: contextPartyId || urlPartyId, time: player.currentTime() });
                    }
                    isSeekingFromServer.current = false;
                }, 500);
                player.on('seeked', handleSeek);
            }
            socket.current.on('play', (time) => {
                if (isPlayerReady) {
                    player.currentTime(time);
                    player.play();
                }
            });
            socket.current.on('pause', (time) => {
                if (isPlayerReady) {
                    player.currentTime(time);
                    player.pause();
                }
            });
            socket.current.on('seek', (time) => {
                if (isPlayerReady) {
                    isSeekingFromServer.current = true;
                    player.currentTime(time);
                }
            });
            socket.current.on('sync', ({ time, isPlaying }) => {
                if (isPlayerReady) {
                    const currentTime = player.currentTime();
                    if (Math.abs(currentTime - time) > SYNC_THRESHOLD) {
                        player.currentTime(time);
                    }
                    if (isPlaying && player.paused()) {
                        player.play();
                    } else if (!isPlaying && !player.paused()) {
                        player.pause();
                    }
                } else {
                    latestSyncState.current = { time, isPlaying };
                }
            });
            socket.current.on('videoSet', (url) => {
                setVideoUrl(url);
            });
            socket.current.on('streamReady', (url) => {
                setStreamUrl(url);
                setIsStreamReady(true);
            });
            socket.current.on('chatMessage', (data) => {
                setChatMessages((prev) => [...prev, data]);
            });
        }
        return () => {
            if (socket.current) {
                socket.current.disconnect();
            }
        };
    }, [contextPartyId, userId, isLeader, isPlayerReady, urlPartyId, navigate]);

    useEffect(() => {
        let syncInterval;
        if (isLeader && isPlayerReady && socket.current && playerRef.current) {
            syncInterval = setInterval(() => {
                const player = playerRef.current;
                const syncData = {
                    partyId: contextPartyId || urlPartyId,
                    time: player.currentTime(),
                    isPlaying: !player.paused(),
                };
                socket.current.emit('sync', syncData);
            }, SYNC_INTERVAL);
        }
        return () => {
            if (syncInterval) clearInterval(syncInterval);
        };
    }, [isLeader, isPlayerReady, contextPartyId, urlPartyId]);

    useEffect(() => {
        if (isStreamReady && streamUrl && isPlayerReady && playerRef.current) {
            setTimeout(() => {
                playerRef.current.reset();
                playerRef.current.src({ type: 'application/x-mpegURL', src: streamUrl });
                playerRef.current.load();
            }, 100);
        }
    }, [isStreamReady, streamUrl, isPlayerReady]);

    useEffect(() => {
        if (isLeader && videoUrl && isPlayerReady && !isStreamReady) {
            handleStartStream();
        }
    }, [isLeader, videoUrl, isPlayerReady, isStreamReady]);

    const handleStartStream = async () => {
        const response = await axios.post(`${config.host}/api/start-stream`, { partyId: contextPartyId || urlPartyId, videoUrl });
        if (response.data.success) {
            const fullStreamUrl = response.data.streamUrl + '?t=' + Date.now();
            setStreamUrl(fullStreamUrl);
            setIsStreamReady(true);
        }
    };

    // Moved functions to PartyRoom
    const handleInput = (e) => {
        const div = e.target;
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);

        if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const textNode = range.startContainer;
            const offset = range.startOffset;
            const text = textNode.textContent;

            if (offset > 0 && text[offset - 1] === ' ') {
                const words = text.substring(0, offset - 1).split(' ');
                const lastWord = words[words.length - 1];

                if (customEmojis[lastWord]) {
                    const img = document.createElement('img');
                    img.src = customEmojis[lastWord];
                    img.alt = lastWord;
                    img.className = 'emoji';
                    img.setAttribute('data-code', lastWord);
                    img.contentEditable = 'false';
                    img.style.height = '18px';
                    img.style.verticalAlign = 'middle';
                    img.style.display = 'inline-block';

                    const wordStart = offset - 1 - lastWord.length;
                    const wordRange = document.createRange();
                    wordRange.setStart(textNode, wordStart);
                    wordRange.setEnd(textNode, offset - 1);
                    wordRange.deleteContents();
                    wordRange.insertNode(img);

                    const newRange = document.createRange();
                    newRange.setStartAfter(img);
                    newRange.setEndAfter(img);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
            }
        }
    };

    const handleKeyDown = (e) => {
        // Handled in ChatInput
    };

    const handleEmojiClick = (emojiCode, contentEditableRef) => {
        const div = contentEditableRef.current;
        div.focus();

        const selection = window.getSelection();
        let range;

        if (selection.rangeCount > 0 && div.contains(selection.getRangeAt(0).commonAncestorContainer)) {
            range = selection.getRangeAt(0);
        } else {
            range = document.createRange();
            range.selectNodeContents(div);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        const img = document.createElement('img');
        img.src = customEmojis[emojiCode];
        img.alt = emojiCode;
        img.className = 'emoji';
        img.setAttribute('data-code', emojiCode);
        img.contentEditable = 'false';
        img.style.height = '18px';
        img.style.verticalAlign = 'middle';
        img.style.display = 'inline-block';

        range.insertNode(img);
        range.setStartAfter(img);
        range.setEndAfter(img);
        selection.removeAllRanges();
        selection.addRange(range);
    };

    const sendChatMessage = (message) => {
        const messageData = {
            partyId: contextPartyId || urlPartyId,
            userId,
            message,
        };
        socket.current.emit('chatMessage', messageData);
        setChatMessages((prev) => [...prev, { userId, message, timestamp: Date.now() }]);
    };

    const renderMessageWithEmojis = (text) => {
        const keys = Object.keys(customEmojis).map((k) =>
            k.replace(/([.*+?^${}()|\[\]\/\\])/g, '\\$1')
        );
        const regex = new RegExp(`(${keys.join('|')})`, 'g');
        const parts = text.split(regex);
        return parts.map((part, index) => {
            if (customEmojis[part]) {
                return (
                    <img
                        key={index}
                        src={customEmojis[part]}
                        alt={part}
                        style={{ height: '18px', verticalAlign: 'middle', display: 'inline-block' }}
                    />
                );
            } else {
                return part;
            }
        });
    };

    useEffect(() => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTo({
                top: chatMessagesRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
        if (chatSidebarRef.current) {
            chatSidebarRef.current.scrollTo({
                top: chatSidebarRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
        if (chatMessages.length > 0 && !isChatVisible) {
            setIsChatVisible(true);
        }
    }, [chatMessages]);

    const toggleChat = () => {
        setIsChatVisible(!isChatVisible);
    };

    return (
        <div className="party-room">
            <div className="room-header">
                <h2>Party Room: {contextPartyId || urlPartyId}</h2>
                <div
                    className="online-users"
                    onMouseEnter={() => setShowUserList(true)}
                    onMouseLeave={() => setShowUserList(false)}
                >
                    Online: {onlineUsers.length}
                    {showUserList && (
                        <div className="user-list">
                            {leader && (
                                <div key="leader">
                                    {leader} (Leader)
                                </div>
                            )}
                            {onlineUsers.filter(user => user !== leader).map((user, index) => (
                                <div key={index}>
                                    {user}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="room-content">
                <div className="video-container">
                    <div className="video-player" data-vjs-player>
                        <video ref={videoRef} className="video-js vjs-big-play-centered" />
                        <div className={`chat-overlay ${isChatVisible ? 'visible' : 'hidden'}`}>
                            <button
                                style={{
                                    position: 'absolute',
                                    right: '16px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#fff',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                }}
                                onClick={toggleChat}
                            >
                                ✖
                            </button>
                            <div className="chat-messages" ref={chatMessagesRef}>
                                {chatMessages.map((msg, index) => (
                                    <div key={index} className="chat-message">
                                        <div className="user">
                                            {msg.userId === userId ? 'You' : msg.userId}
                                        </div>
                                        <div className="text" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: 'block' }}>
                                            {renderMessageWithEmojis(msg.message)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <ChatInput
                                onSend={sendChatMessage}
                                showEmojiPicker={showEmojiPicker}
                                setShowEmojiPicker={setShowEmojiPicker}
                                customEmojis={customEmojis}
                                handleInput={handleInput}
                                handleKeyDown={handleKeyDown}
                                handleEmojiClick={handleEmojiClick} // Fixed here
                            />
                        </div>
                        {!isChatVisible && (
                            <button
                                className="chat-toggle-btn"
                                onClick={toggleChat}
                                aria-label="Show chat"
                            >
                                <span className="chat-toggle-icon">{"<"}</span>
                            </button>
                        )}
                    </div>
                    {!isStreamReady && <p className="waiting-message">Waiting for stream to start...</p>}
                </div>
                {!isFullscreen && (
                    <div className="chat-sidebar">
                        <div className="chat-header">Chat</div>
                        <div className="chat-messages" ref={chatSidebarRef}>
                            {chatMessages.map((msg, index) => (
                                <div key={index} className="chat-message">
                                    <div className="user">
                                        {msg.userId === userId ? 'You' : msg.userId.substring(0, 5)}
                                    </div>
                                    <div className="text" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: 'block' }}>
                                        {renderMessageWithEmojis(msg.message)}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <ChatInput
                            onSend={sendChatMessage}
                            showEmojiPicker={showEmojiPicker}
                            setShowEmojiPicker={setShowEmojiPicker}
                            customEmojis={customEmojis}
                            handleInput={handleInput}
                            handleKeyDown={handleKeyDown}
                            handleEmojiClick={handleEmojiClick}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default PartyRoom;