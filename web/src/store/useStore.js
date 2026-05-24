import { create } from 'zustand';

const useStore = create((set, get) => ({
  // 인증
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null, channels: [], messages: {}, activeChannelId: null }),

  // 채널
  channels: [],
  activeChannelId: null,
  setChannels: (channels) => set({ channels }),
  setActiveChannel: (id) => set({ activeChannelId: id }),

  updateChannelUnread: (channelId, count) => set(state => ({
    channels: state.channels.map(ch =>
      ch.id === channelId ? { ...ch, unread_count: count } : ch
    ),
  })),

  markChannelRead: (channelId) => set(state => ({
    channels: state.channels.map(ch =>
      ch.id === channelId ? { ...ch, unread_count: 0 } : ch
    ),
  })),

  updateLastMessage: (channelId, body, at) => set(state => ({
    channels: state.channels.map(ch =>
      ch.id === channelId ? { ...ch, last_message: body, last_message_at: at } : ch
    ),
  })),

  // 메시지 (channelId 키)
  messages: {},
  setMessages: (channelId, msgs) => set(state => ({
    messages: { ...state.messages, [channelId]: msgs },
  })),
  appendMessage: (channelId, msg) => set(state => ({
    messages: {
      ...state.messages,
      [channelId]: [...(state.messages[channelId] || []), msg],
    },
  })),
  prependMessages: (channelId, msgs) => set(state => ({
    messages: {
      ...state.messages,
      [channelId]: [...msgs, ...(state.messages[channelId] || [])],
    },
  })),

  // 사용자 목록
  users: [],
  setUsers: (users) => set({ users }),

  // 온라인 상태 (userId → 'online'|'offline')
  presence: {},
  setPresence: (userId, status) => set(state => ({
    presence: { ...state.presence, [userId]: status },
  })),

  // 읽음 상태 { channelId: { userId: lastReadAt } }
  channelReaders: {},
  setChannelReaders: (channelId, readers) => set(state => ({
    channelReaders: { ...state.channelReaders, [channelId]: readers },
  })),
  updateReader: (channelId, userId, lastReadAt) => set(state => ({
    channelReaders: {
      ...state.channelReaders,
      [channelId]: { ...(state.channelReaders[channelId] || {}), [userId]: lastReadAt },
    },
  })),

  // 타이핑 (channelId → [{ userId, userName }])
  typing: {},
  setTyping: (channelId, userId, userName, isTyping) => set(state => {
    const current = state.typing[channelId] || [];
    const filtered = current.filter(t => t.userId !== userId);
    return {
      typing: {
        ...state.typing,
        [channelId]: isTyping ? [...filtered, { userId, userName }] : filtered,
      },
    };
  }),
}));

export default useStore;
