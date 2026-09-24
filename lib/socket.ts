"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

export const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

/**
 * Singleton Socket.io client connector with graceful reconnection
 */
export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;

  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 5000,
    });

    socketInstance.on("connect", () => {
      console.log("[TRACIA Socket.IO] Connected to real-time relay:", socketInstance?.id);
    });

    socketInstance.on("connect_error", () => {
      // Fallback in background
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("[TRACIA Socket.IO] Disconnected:", reason);
    });
  }

  return socketInstance;
}

/**
 * React hook for consuming real-time socket events and connection state
 */
export function useSocket() {
  const [connected, setConnected] = useState<boolean>(false);
  const [transport, setTransport] = useState<string>("N/A");
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    socketRef.current = s;

    if (s.connected) {
      setConnected(true);
      setTransport(s.io.engine?.transport?.name || "websocket");
    }

    const onConnect = () => {
      setConnected(true);
      setTransport(s.io.engine?.transport?.name || "websocket");
    };

    const onDisconnect = () => {
      setConnected(false);
      setTransport("disconnected");
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
    };
  }, []);

  const emitEvent = (event: string, payload: unknown) => {
    if (socketRef.current) {
      socketRef.current.emit(event, payload);
    }
  };

  return {
    socket: socketRef.current,
    connected,
    transport,
    emitEvent,
  };
}

/**
 * Broadcast event helpers for application events
 */
export function broadcastCaseCreated(caseItem: unknown) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit("case:create", caseItem);
  }
}

export function broadcastCaseUpdated(id: string, patch: unknown) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit("case:update", { id, patch });
  }
}

export function broadcastFirRegistered(firRecord: unknown) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit("fir:register", firRecord);
  }
}

export function broadcastEvidenceUploaded(evidence: unknown) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit("evidence:upload", evidence);
  }
}

export function broadcastAiPipelineStep(step: number, label: string, caseId: string) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit("ai:step", { step, label, caseId, timestamp: new Date().toISOString() });
  }
}
