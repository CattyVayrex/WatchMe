import React, { createContext, useState, useEffect } from 'react';

export const PartyContext = createContext();

export const PartyProvider = ({ children }) => {
  const [partyId, setPartyId] = useState(null);
  // userId now stores the username; initialize from localStorage if available.
  const [userId, setUserId] = useState(localStorage.getItem('username') || null);
  const [password, setPassword] = useState(localStorage.getItem('password') || null);
  const [isLeader, setIsLeader] = useState(false);

  // Persist changes to localStorage.
  useEffect(() => {
    if (userId) {
      localStorage.setItem('username', userId);
    }
  }, [userId]);

  useEffect(() => {
    if (password) {
      localStorage.setItem('password', password);
    }
  }, [password]);

  return (
    <PartyContext.Provider value={{ partyId, setPartyId, userId, setUserId, password, setPassword, isLeader, setIsLeader }}>
      {children}
    </PartyContext.Provider>
  );
};
