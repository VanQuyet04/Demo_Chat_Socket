// Global variables
let socket;
let currentUser = null;
let currentChat = null;
let currentChatType = null; // 'private' or 'room'
let typingTimeout = null;
let onlineUsers = new Set(); // Track online users

// DOM elements
const authModal = document.getElementById('authModal');
const chatInterface = document.getElementById('chatInterface');
const currentUserSpan = document.getElementById('currentUser');
const usersList = document.getElementById('usersList');
const roomsList = document.getElementById('roomsList');
const messagesList = document.getElementById('messagesList');
const messageInput = document.getElementById('messageInput');
const chatTitle = document.getElementById('chatTitle');
const typingIndicator = document.getElementById('typingIndicator');
const noChatSelected = document.getElementById('noChatSelected');
const chatWindow = document.getElementById('chatWindow');

// Check if user is already logged in
const token = localStorage.getItem('chatToken');
if (token) {
    currentUser = JSON.parse(localStorage.getItem('chatUser'));
    showChatInterface();
    connectSocket();
} else {
    showAuthModal();
}

// Authentication functions
function switchTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabs = document.querySelectorAll('.auth-tabs .tab-btn');
    
    tabs.forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    }
}

async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('chatToken', data.token);
            localStorage.setItem('chatUser', JSON.stringify(data.user));
            currentUser = data.user;
            showChatInterface();
            connectSocket();
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (error) {
        alert('Login failed. Please try again.');
    }
}

async function register() {
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    
    if (!username || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('chatToken', data.token);
            localStorage.setItem('chatUser', JSON.stringify(data.user));
            currentUser = data.user;
            showChatInterface();
            connectSocket();
        } else {
            alert(data.error || 'Registration failed');
        }
    } catch (error) {
        alert('Registration failed. Please try again.');
    }
}

function logout() {
    localStorage.removeItem('chatToken');
    localStorage.removeItem('chatUser');
    if (socket) {
        socket.disconnect();
    }
    currentUser = null;
    currentChat = null;
    showAuthModal();
}

function showAuthModal() {
    authModal.style.display = 'flex';
    chatInterface.style.display = 'none';
}

function showChatInterface() {
    authModal.style.display = 'none';
    chatInterface.style.display = 'flex';
    currentUserSpan.textContent = currentUser.username;
    loadUsers();
    loadRooms();
}

// Socket connection
function connectSocket() {
    const token = localStorage.getItem('chatToken');
    socket = io({
        auth: {
            token: token
        }
    });
    
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
    
    socket.on('private_message', (message) => {
        console.log('Received private message:', message);
        console.log('Current chat:', currentChat);
        console.log('Current chat type:', currentChatType);
        
        if (currentChat && currentChatType === 'private' && 
            ((message.sender_id === currentChat.id && message.receiver_id === currentUser.id) || 
             (message.sender_id === currentUser.id && message.receiver_id === currentChat.id))) {
            displayMessage(message);
        }
    });
    
    socket.on('room_message', (message) => {
        if (currentChat && currentChatType === 'room' && message.room_id === currentChat.id) {
            displayMessage(message);
        }
    });
    
    socket.on('typing_start', (data) => {
        if (currentChat && 
            ((currentChatType === 'private' && data.userId === currentChat.id) ||
             (currentChatType === 'room' && data.roomId === currentChat.id))) {
            showTypingIndicator(data.username);
        }
    });
    
    socket.on('typing_stop', (data) => {
        if (currentChat && 
            ((currentChatType === 'private' && data.userId === currentChat.id) ||
             (currentChatType === 'room' && data.roomId === currentChat.id))) {
            hideTypingIndicator();
        }
    });
    
    socket.on('message_seen', (data) => {
        console.log('Received message_seen event:', data);
        updateMessageStatus(data.messageId, 'seen', data.seenByUsername);
    });
    
    socket.on('user_online', (data) => {
        console.log('User online:', data);
        onlineUsers.add(data.userId);
        updateUserStatus(data.userId, true);
    });
    
    socket.on('user_offline', (data) => {
        console.log('User offline:', data);
        onlineUsers.delete(data.userId);
        updateUserStatus(data.userId, false);
    });
}

// Chat functions
function switchChatTab(tab) {
    const privateChatList = document.getElementById('privateChatList');
    const groupChatList = document.getElementById('groupChatList');
    const tabs = document.querySelectorAll('.sidebar-tabs .tab-btn');
    
    tabs.forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    if (tab === 'private') {
        privateChatList.style.display = 'block';
        groupChatList.style.display = 'none';
    } else {
        privateChatList.style.display = 'none';
        groupChatList.style.display = 'block';
    }
    
    // Clear current chat
    currentChat = null;
    showNoChatSelected();
}

async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        
        usersList.innerHTML = '';
        users.forEach(user => {
            if (user.id !== currentUser.id) {
                const userItem = createUserItem(user);
                usersList.appendChild(userItem);
            }
        });
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

async function loadRooms() {
    try {
        const response = await fetch('/api/rooms');
        const rooms = await response.json();
        
        roomsList.innerHTML = '';
        rooms.forEach(room => {
            const roomItem = createRoomItem(room);
            roomsList.appendChild(roomItem);
        });
    } catch (error) {
        console.error('Failed to load rooms:', error);
    }
}

function createUserItem(user) {
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    userItem.setAttribute('data-user-id', user.id);
    userItem.onclick = () => selectUser(user);
    
    // Check if user is online (exclude current user)
    const isOnline = user.id !== currentUser.id && onlineUsers.has(user.id);
    
    userItem.innerHTML = `
        <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
        <div class="user-info">
            <div class="username">${user.username}</div>
            <div class="status ${isOnline ? 'online' : 'offline'}">${isOnline ? 'online' : 'offline'}</div>
        </div>
    `;
    
    return userItem;
}

function createRoomItem(room) {
    const roomItem = document.createElement('div');
    roomItem.className = 'room-item';
    roomItem.onclick = () => selectRoom(room);
    
    roomItem.innerHTML = `
        <div class="room-icon">#</div>
        <div class="room-info">
            <div class="room-name">${room.name}</div>
            <div class="created-by">by ${room.created_by_name}</div>
        </div>
    `;
    
    return roomItem;
}

function selectUser(user) {
    // Remove active class from all items
    document.querySelectorAll('.user-item, .room-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to selected user
    event.currentTarget.classList.add('active');
    
    currentChat = user;
    currentChatType = 'private';
    chatTitle.textContent = user.username;
    
    showChatWindow();
    loadMessages('private', user.id);
    
    // Join user's personal room for private messages
    socket.emit('join_room', `user_${user.id}`);
}

function selectRoom(room) {
    // Remove active class from all items
    document.querySelectorAll('.user-item, .room-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to selected room
    event.currentTarget.classList.add('active');
    
    currentChat = room;
    currentChatType = 'room';
    chatTitle.textContent = room.name;
    
    showChatWindow();
    loadMessages('room', room.id);
    
    // Join room
    socket.emit('join_room', room.id);
}

async function loadMessages(type, id) {
    try {
        let url = `/api/messages/${type}/${id}`;
        if (type === 'private') {
            url += `?currentUserId=${currentUser.id}`;
        }
        
        const response = await fetch(url);
        const messages = await response.json();
        
        messagesList.innerHTML = '';
        messages.forEach(message => {
            displayMessage(message);
        });
        
        scrollToBottom();
    } catch (error) {
        console.error('Failed to load messages:', error);
    }
}

function displayMessage(message) {
    const messageDiv = document.createElement('div');
    const isSent = message.sender_id === currentUser.id;
    
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    messageDiv.setAttribute('data-message-id', message.id);
    
    const time = new Date(message.created_at).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const statusIcon = isSent ? getStatusIcon(message.status || 'sent') : '';
    
    messageDiv.innerHTML = `
        <div class="message-info">
            <span class="sender-name">${message.sender_name}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-content">${message.content}</div>
        ${statusIcon ? `<div class="message-status">${statusIcon}</div>` : ''}
    `;
    
    messagesList.appendChild(messageDiv);
    scrollToBottom();
    
    // Mark message as seen if received
    if (!isSent) {
        markMessageAsSeen(message.id);
    }
}

function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || !currentChat) return;
    
    if (currentChatType === 'private') {
        socket.emit('private_message', {
            receiverId: currentChat.id,
            content: content
        });
    } else if (currentChatType === 'room') {
        socket.emit('room_message', {
            roomId: currentChat.id,
            content: content
        });
    }
    
    messageInput.value = '';
    hideTypingIndicator();
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function handleTyping() {
    if (!currentChat) return;
    
    // Clear existing timeout
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    
    // Emit typing start
    if (currentChatType === 'private') {
        socket.emit('typing_start', {
            type: 'private',
            receiverId: currentChat.id
        });
    } else if (currentChatType === 'room') {
        socket.emit('typing_start', {
            type: 'room',
            roomId: currentChat.id
        });
    }
    
    // Set timeout to stop typing indicator
    typingTimeout = setTimeout(() => {
        if (currentChatType === 'private') {
            socket.emit('typing_stop', {
                type: 'private',
                receiverId: currentChat.id
            });
        } else if (currentChatType === 'room') {
            socket.emit('typing_stop', {
                type: 'room',
                roomId: currentChat.id
            });
        }
    }, 1000);
}

function showTypingIndicator(username) {
    typingIndicator.innerHTML = `
        <i class="fas fa-circle"></i>
        <span>${username} đang nhập tin nhắn</span>
        <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    typingIndicator.style.display = 'flex';
}

function hideTypingIndicator() {
    typingIndicator.style.display = 'none';
}

function scrollToBottom() {
    const messagesContainer = document.querySelector('.messages-container');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showChatWindow() {
    noChatSelected.style.display = 'none';
    chatWindow.style.display = 'flex';
}

function showNoChatSelected() {
    noChatSelected.style.display = 'flex';
    chatWindow.style.display = 'none';
}

// Room management
function showCreateRoomModal() {
    document.getElementById('createRoomModal').style.display = 'flex';
}

function hideCreateRoomModal() {
    document.getElementById('createRoomModal').style.display = 'none';
    document.getElementById('roomName').value = '';
}

async function createRoom() {
    const roomName = document.getElementById('roomName').value.trim();
    if (!roomName) {
        alert('Please enter a room name');
        return;
    }
    
    try {
        const response = await fetch('/api/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                name: roomName,
                userId: currentUser.id 
            })
        });
        
        const room = await response.json();
        
        if (response.ok) {
            hideCreateRoomModal();
            loadRooms(); // Refresh rooms list
        } else {
            alert('Failed to create room');
        }
    } catch (error) {
        alert('Failed to create room');
    }
}

// Utility functions
function refreshUsers() {
    loadUsers();
}

function updateUserStatus(userId, isOnline) {
    const userItem = document.querySelector(`[data-user-id="${userId}"]`);
    if (userItem) {
        const statusDiv = userItem.querySelector('.status');
        if (statusDiv) {
            statusDiv.textContent = isOnline ? 'online' : 'offline';
            statusDiv.className = `status ${isOnline ? 'online' : 'offline'}`;
        }
    }
}

function getStatusIcon(status) {
    switch(status) {
        case 'sent':
            return '<i class="fas fa-check" title="Đã gửi"></i>';
        case 'delivered':
            return '<i class="fas fa-check-double" title="Đã nhận"></i>';
        case 'seen':
            return '<i class="fas fa-check-double" style="color: #4CAF50;" title="Đã xem"></i>';
        default:
            return '<i class="fas fa-clock" title="Đang gửi"></i>';
    }
}

function updateMessageStatus(messageId, status, seenByUsername = '') {
    console.log('Updating message status:', messageId, status, seenByUsername);
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageDiv) {
        const statusDiv = messageDiv.querySelector('.message-status');
        if (statusDiv) {
            statusDiv.innerHTML = getStatusIcon(status);
            if (status === 'seen' && seenByUsername) {
                statusDiv.setAttribute('title', `Đã xem bởi ${seenByUsername}`);
            }
            console.log('Message status updated successfully');
        } else {
            console.log('Status div not found');
        }
    } else {
        console.log('Message div not found for ID:', messageId);
    }
}

function markMessageAsSeen(messageId) {
    if (!currentChat) return;
    
    console.log('Marking message as seen:', messageId, 'in chat:', currentChat);
    
    // Send seen notification to server
    if (currentChatType === 'private') {
        socket.emit('message_seen', {
            type: 'private',
            messageId: messageId,
            senderId: currentChat.id
        });
        console.log('Sent message_seen for private chat');
    } else if (currentChatType === 'room') {
        socket.emit('message_seen', {
            type: 'room',
            messageId: messageId,
            roomId: currentChat.id
        });
        console.log('Sent message_seen for room chat');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Close modals when clicking outside
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
}); 