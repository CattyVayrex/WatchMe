import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PartyContext } from '../context/PartyContext';
import './LandingPage.css';
import { config } from '../config';

const LandingPage = () => {
    const [partyCode, setPartyCode] = useState('');
    const [initialVideoUrl, setInitialVideoUrl] = useState('');
    const [usernameInput, setUsernameInput] = useState('');
    const { setPartyId, userId, setUserId, password, setPassword, setIsLeader } = useContext(PartyContext);
    const navigate = useNavigate();

    // Pre-fill username input if it exists in context/localStorage
    useEffect(() => {
        if (userId) {
            setUsernameInput(userId);
        }
    }, [userId]);

    // Generate a simple random password
    const generatePassword = () => {
        return Math.random().toString(36).slice(-8);
    };

    // Ensure credentials exist; if not, generate and store them
    const handleCredentials = () => {
        if (!usernameInput.trim()) {
            alert('Please enter a username');
            return false;
        }
        if (!userId || !password) {
            const newPassword = generatePassword();
            setUserId(usernameInput);
            setPassword(newPassword);
            localStorage.setItem('username', usernameInput);
            localStorage.setItem('password', newPassword);
        }
        return true;
    };

    const createParty = async () => {
        if (!handleCredentials()) return;
        setIsLeader(true);
        try {
            const response = await axios.post(`${config.host}/api/create-party`, { username: usernameInput, password, videoUrl: initialVideoUrl });
            setPartyId(response.data.partyId);
            localStorage.setItem('token', response.data.token);
            navigate(`/party/${response.data.partyId}`);
        } catch (error) {
            alert(error.response?.data?.message || 'Error creating party');
        }
    };

    const joinParty = async () => {
        if (!handleCredentials()) return;
        setIsLeader(false);
        try {
            const response = await axios.post(`${config.host}/api/join-party`, { partyId: partyCode, username: usernameInput, password });
            if (response.data.success) {
                setPartyId(partyCode);
                localStorage.setItem('token', response.data.token);
                navigate(`/party/${partyCode}`);
            } else {
                alert('Party not found');
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Error joining party');
        }
    };

    return (
        <div className="landing-page-container">
            <h1 className="landing-title">WatchMe</h1>
            <div className="form-container">
                <h2 className="section-title">Enter your username</h2>
                <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Username"
                    className="input-field"
                />
                <div className="sections-container">
                    <div className="card">
                        <h3>Join an Existing Party</h3>
                        <input
                            type="text"
                            value={partyCode}
                            onChange={(e) => setPartyCode(e.target.value)}
                            placeholder="Party Code"
                            className="input-field"
                        />
                        <button onClick={joinParty} className="join-button">
                            Join Party
                        </button>
                    </div>
                    <div className="card">
                        <h3>Create a New Party</h3>
                        <input
                            type="text"
                            value={initialVideoUrl}
                            onChange={(e) => setInitialVideoUrl(e.target.value)}
                            placeholder="Initial Video URL (.mp4, .mkv)"
                            className="input-field"
                        />
                        <button onClick={createParty} className="create-button">
                            Create Party
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;