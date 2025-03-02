import React, { useRef, useState } from 'react';

const ChatInput = ({ onSend, showEmojiPicker, setShowEmojiPicker, customEmojis, handleInput, handleKeyDown, handleEmojiClick }) => {
    const contentEditableRef = useRef(null);
    const [isEmpty, setIsEmpty] = useState(true);

    // Function to get plain text, handling text nodes, emojis, and line breaks
    const getPlainText = (node) => {
        let text = '';
        node.childNodes.forEach((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
                text += child.textContent;
            } else if (child.nodeName === 'IMG' && child.classList.contains('emoji')) {
                text += child.getAttribute('data-code');
            } else if (child.nodeName === 'BR') {
                text += '\n';
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                text += getPlainText(child);
            }
        });
        return text;
    };

    // Send message
    const sendMessage = () => {
        if (!contentEditableRef.current) {
            console.error('Content editable ref is null');
            return;
        }
        const message = getPlainText(contentEditableRef.current).trim();
        if (message !== '') {
            onSend(message);
            contentEditableRef.current.innerHTML = '';
            setIsEmpty(true);
            setShowEmojiPicker(false);
        }
    };

    // Handle emoji insertion
    const insertEmoji = (emojiCode) => {
        const img = document.createElement('img');
        img.src = customEmojis[emojiCode];
        img.className = 'emoji';
        img.setAttribute('data-code', emojiCode);
        img.style.height = '20px';
        img.style.display = 'inline-block';

        const div = contentEditableRef.current;
        div.appendChild(img);
        div.focus();
        const range = document.createRange();
        range.setStartAfter(img);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        setIsEmpty(false);
    };

    // Check if the input is empty
    const checkIsEmpty = (e) => {
        const text = getPlainText(contentEditableRef.current).trim();
        setIsEmpty(text === '');
        if (handleInput) handleInput(e);
    };

    return (
        <div className="chat-input-container" style={{ position: 'relative', display: 'flex', gap: 12 }}>
            <div
                contentEditable
                ref={contentEditableRef}
                className="chat-input"
                onInput={checkIsEmpty} // Only check emptiness, no rebuilding
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                    if (handleKeyDown) handleKeyDown(e);
                }}
                style={{
                    minHeight: '20px',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'transparent',
                    color: '#fff',
                    outline: 'none',
                    whiteSpace: 'pre-wrap',
                    overflowY: 'auto',
                    maxHeight: '100px',
                    lineHeight: '16px',
                    fontSize: '13px',
                    overflowWrap: 'anywhere',
                    display: 'block',
                    flex: 1
                }}
            />
            {isEmpty && (
                <div
                    style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'rgba(255, 255, 255, 0.5)',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        fontSize: '12px',
                    }}
                >
                    Meow...
                </div>
            )}
            <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                style={{ cursor: 'pointer' }}
            >
                <img style={{ width: 22 }} src="/emojis/smile.png" alt="Emoji" />
            </button>
            <button
                type="button"
                onClick={sendMessage}
                style={{ cursor: 'pointer' }}
            >
                <img style={{ width: 18 }} src="/emojis/send.png" alt="Send" />
            </button>
            <div
                className={`emoji-picker ${showEmojiPicker ? 'visible' : 'hidden'}`}
                style={{
                    position: 'absolute',
                    bottom: '40px',
                    right: '10px',
                    gap: '4px',
                    background: '#242424',
                    borderRadius: '4px',
                    padding: '4px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    zIndex: 1000,
                }}
            >
                {Object.keys(customEmojis).map((key) => (
                    <img
                        key={key}
                        src={customEmojis[key]}
                        alt={key}
                        onClick={() => {
                            insertEmoji(key);
                        }}
                        style={{ height: '20px', cursor: 'pointer', margin: '1px' }}
                    />
                ))}
            </div>
        </div>
    );
};

export default ChatInput;