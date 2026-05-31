import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    socket = io(socketUrl, {
      withCredentials: true,
      auth: { token: localStorage.getItem('accessToken') },
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
