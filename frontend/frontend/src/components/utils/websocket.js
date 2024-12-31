import { useEffect, useRef, useState } from 'react';

const useWebSocket = (url, onMessage, onError = () => {}, onClose = () => {}) => {
  const socketRef = useRef(null);
  const [status, setStatus] = useState('closed');

  useEffect(() => {
    const socket = new WebSocket(url);
    socketRef.current = socket;
    setStatus('connecting');

    socket.onopen = () => setStatus('connected');
    socket.onmessage = (event) => onMessage(JSON.parse(event.data));
    socket.onerror = (error) => {
      setStatus('error');
      onError(error);
    };
    socket.onclose = () => {
      setStatus('closed');
      onClose();
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [url, onMessage, onError, onClose]);

  const sendMessage = (message) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  };

  return { status, sendMessage };
};

export default useWebSocket;
