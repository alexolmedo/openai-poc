import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  speaker: 'user' | 'system';
  text: string;
  timestamp: string;
}

interface Conversation {
  _id: string;
  clientId: string;
  messages: Message[];
}

const ChatComponent: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [clientId, setClientId] = useState('');
  const [history, setHistory] = useState<Conversation[]>([]);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    const storedClientId = localStorage.getItem('clientId');
    if (storedClientId) {
      setClientId(storedClientId);
      fetchHistory(storedClientId);
    } else {
      const newClientId = uuidv4();
      setClientId(newClientId);
      localStorage.setItem('clientId', newClientId);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchHistory = async (clientId: string) => {
    const response = await fetch(`/api/history?clientId=${clientId}`);
    const data = await response.json();
    setHistory(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      speaker: 'user',
      text: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: input }],
        clientId
      }),
    });

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let systemResponse = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5);
            if (data === '[DONE]') {
              const systemMessage: Message = {
                speaker: 'system',
                text: systemResponse,
                timestamp: new Date().toISOString()
              };
              setMessages(prev => [...prev, systemMessage]);
              fetchHistory(clientId);
            } else {
              try {
                const parsed = JSON.parse(data);
                systemResponse += parsed.content;
                const systemMessage: Message = {
                  speaker: 'system',
                  text: systemResponse,
                  timestamp: new Date().toISOString()
                };
                setMessages(prev => [...prev.slice(0, -1), systemMessage]);
              } catch (error) {
                console.error('Error parsing JSON:', error);
              }
            }
          }
        }
      }
    }
  };

  const handleHistoryClick = (conversation: Conversation) => {
    setMessages(conversation.messages);
  };

  return (
      <div className="chat-container">
        <div className="history-sidebar">
          <h3>Chat History</h3>
          {history.map((conv) => (
              <div key={conv._id} onClick={() => handleHistoryClick(conv)} className="history-item">
                {conv.messages[0].text.substring(0, 30)}...
              </div>
          ))}
        </div>
        <div className="chat-main">
          <div className="message-container">
            {messages.map((msg, index) => (
                <div key={index} className={`message ${msg.speaker}`}>
                  <pre>{msg.text}</pre>
                </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSubmit} className="input-form">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
            />
            <button type="submit">Send</button>
          </form>
        </div>
      </div>
  );
};

export default ChatComponent;