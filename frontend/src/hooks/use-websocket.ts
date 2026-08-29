import { useEffect, useRef, useState, useCallback } from "react";

type WebSocketOptions = {
  url?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
};

export function useWebSocket(options: WebSocketOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws",
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    onOpen,
    onClose,
    onError,
    onMessage,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Subscriptions handling
  const subscribersRef = useRef<Record<string, Set<(data: any) => void>>>({});

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Optional: Get token from cookies or localStorage
    let token = "";
    if (typeof window !== "undefined") {
      token = localStorage.getItem("token") || "";
      if (!token) {
        const match = document.cookie.match(new RegExp('(^| )token=([^;]+)'));
        if (match) token = match[2];
      }
    }

    const wsUrl = token ? `${url}?token=${token}` : url;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = (event) => {
        setIsConnected(true);
        reconnectCountRef.current = 0;
        
        // Start ping heartbeat
        pingTimerRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000); // 30 seconds

        onOpen?.(event);
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        if (pingTimerRef.current) clearInterval(pingTimerRef.current);
        
        onClose?.(event);

        if (reconnectCountRef.current < reconnectAttempts) {
          const delay = reconnectInterval * Math.pow(2, reconnectCountRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            reconnectCountRef.current++;
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (event) => {
        onError?.(event);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "pong") return; // Ignore heartbeat responses
          
          setLastMessage(data);
          onMessage?.(event);

          if (data.type && subscribersRef.current[data.type]) {
            subscribersRef.current[data.type].forEach(handler => handler(data.payload || data));
          }
        } catch (e) {
          // Non-JSON message
          setLastMessage(event.data);
          onMessage?.(event);
        }
      };
    } catch (e) {
      console.error("WebSocket connection error:", e);
    }
  }, [url, reconnectAttempts, reconnectInterval, onOpen, onClose, onError, onMessage]);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [autoConnect, connect]);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === "string" ? data : JSON.stringify(data));
    } else {
      console.warn("WebSocket is not connected. Cannot send data:", data);
    }
  }, []);

  const subscribe = useCallback((eventType: string, handler: (data: any) => void) => {
    if (!subscribersRef.current[eventType]) {
      subscribersRef.current[eventType] = new Set();
    }
    subscribersRef.current[eventType].add(handler);

    return () => {
      subscribersRef.current[eventType]?.delete(handler);
    };
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  return { isConnected, lastMessage, send, subscribe, connect, disconnect };
}
