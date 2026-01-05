/**
 * WebSocket Hook for Real-Time Position Updates
 * Connects to backend WebSocket server and provides real-time position data
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Position } from '@/types';
import bs58 from 'bs58';

interface WebSocketMessage {
  type: 'position_update' | 'price_update' | 'exit_notification' | 'connection' | 'error';
  data?: any;
  timestamp?: number;
}

interface UseWebSocketReturn {
  positions: Position[];
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';
const RECONNECT_DELAY = 3000; // 3 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export function useWebSocket(
  walletPublicKey: string | null, 
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>
): UseWebSocketReturn {
  const [positions, setPositions] = useState<Position[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (!walletPublicKey || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    cleanup();

    try {
      console.log('[WebSocket] Connecting to', WS_URL);
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('[WebSocket] Connected');
        
        try {
          // 1. Prepare authentication data
          const timestamp = Date.now();
          const messageText = `Subscribe to Canopi: ${timestamp}`;
          const messageBytes = new TextEncoder().encode(messageText);
          
          let signatureBase58 = '';
          
          if (signMessage) {
            // Standard wallet signing
            const signature = await signMessage(messageBytes);
            signatureBase58 = bs58.encode(signature);
          } else {
            // Integrated mode (Skip auth or implement server-side auth if needed)
            // For now, we'll try to subscribe without signature if signMessage is missing (integrated mode)
            // The backend will reject it if it's not in dev mode and missing ADMIN_API_KEY.
            // Note: In integrated mode, the user isn't using Phantom, so they can't sign.
          }

          // 2. Subscribe to wallet positions with signature
          ws.send(JSON.stringify({
            type: 'subscribe_wallet',
            walletPublicKey: walletPublicKey,
            signature: signatureBase58,
            timestamp: timestamp
          }));

          setIsConnected(true);
          setError(null);

          // Start heartbeat
          heartbeatIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, HEARTBEAT_INTERVAL);
        } catch (authError: any) {
          console.error('[WebSocket] Authentication failed:', authError);
          setError('Authentication failed');
          ws.close();
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { type, data } = message;

          switch (type) {
            case 'position_update':
              // Backend sends data as positions array on subscription
              // or data.position for individual updates
              if (Array.isArray(data)) {
                setPositions(data);
              } else if (data?.position) {
                // Update single position
                setPositions(prev => {
                  const index = prev.findIndex(p =>
                    p.mint === data.position.mint &&
                    p.walletPublicKey === data.position.walletPublicKey
                  );
                  if (index >= 0) {
                    const updated = [...prev];
                    updated[index] = data.position;
                    return updated;
                  }
                  return [...prev, data.position];
                });
              }
              break;

            case 'price_update':
              // Backend sends individual price updates: { mint, price, timestamp }
              if (data?.mint && data?.price) {
                setPositions(prev => prev.map(pos => {
                  if (pos.mint === data.mint) {
                    const newProfit = ((data.price - pos.entryPrice) / pos.entryPrice) * 100;
                    return {
                      ...pos,
                      currentPrice: data.price,
                      currentProfit: newProfit,
                      highestProfit: Math.max(pos.highestProfit, newProfit)
                    };
                  }
                  return pos;
                }));
              }
              break;

            case 'exit_notification':
              // Show notification for exit triggers
              if (data) {
                console.log('[WebSocket] Exit triggered:', data);
                // You can integrate with a toast notification library here
                if (typeof window !== 'undefined' && 'Notification' in window) {
                  if (Notification.permission === 'granted') {
                    new Notification('Exit Strategy Triggered', {
                      body: `${data.mint?.slice(0, 8)}: ${data.reason}\nProfit: ${data.profit?.toFixed(2)}%`,
                      icon: '/canopi-icon.svg'
                    });
                  }
                }
              }
              break;

            case 'connection':
              console.log('[WebSocket]', data?.message || 'Connected');
              break;

            case 'error':
              console.error('[WebSocket] Server error:', data?.message);
              setError(data?.message || 'WebSocket error');
              break;
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[WebSocket] Error:', event);
        setError('WebSocket connection error');
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Disconnected:', event.code, event.reason);
        setIsConnected(false);

        // Attempt to reconnect if not manually closed
        if (event.code !== 1000 && walletPublicKey) {
          console.log(`[WebSocket] Reconnecting in ${RECONNECT_DELAY / 1000}s...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        }
      };

    } catch (err) {
      console.error('[WebSocket] Connection failed:', err);
      setError('Failed to establish WebSocket connection');
      setIsConnected(false);
    }
  }, [walletPublicKey, cleanup]);

  // Connect when wallet changes
  useEffect(() => {
    if (walletPublicKey) {
      connect();
    } else {
      cleanup();
      setPositions([]);
    }

    return cleanup;
  }, [walletPublicKey, connect, cleanup]);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  return {
    positions,
    isConnected,
    error,
    reconnect: connect
  };
}
