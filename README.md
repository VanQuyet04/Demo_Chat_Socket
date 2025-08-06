# Chat Socket Demo

Một ứng dụng chat real-time hoàn chỉnh sử dụng Socket.io với tính năng chat 1-1 và chat nhóm.

## 🚀 Tính năng

### Core Features
- ✅ **Authentication**: Đăng ký/Đăng nhập với JWT
- ✅ **Private Chat**: Chat 1-1 giữa các user
- ✅ **Group Chat**: Chat nhóm với nhiều user
- ✅ **Real-time Messaging**: Tin nhắn real-time với Socket.io
- ✅ **Message History**: Lưu và hiển thị tin nhắn cũ
- ✅ **Typing Indicators**: Hiển thị "đang gõ..."
- ✅ **Online Status**: Hiển thị trạng thái online/offline
- ✅ **Responsive Design**: Giao diện đẹp, responsive

### Technical Features
- ✅ **Backend**: Node.js + Express + Socket.io
- ✅ **Database**: SQLite (đơn giản cho demo)
- ✅ **Frontend**: Vanilla JavaScript + HTML + CSS
- ✅ **Security**: JWT Authentication, Password Hashing
- ✅ **Real-time**: WebSocket connections

## 📁 Cấu trúc dự án

```
Chat_Socket/
├── server.js          # Server chính với Express & Socket.io
├── package.json       # Dependencies và scripts
├── chat.db           # SQLite database (tự động tạo)
├── public/           # Frontend files
│   ├── index.html    # Giao diện chính
│   ├── style.css     # CSS styles
│   └── script.js     # JavaScript logic
└── README.md         # Hướng dẫn này
```

## 🛠️ Cài đặt và chạy

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Chạy server
```bash
# Development mode (với nodemon)
npm run dev

# Production mode
npm start
```

### 3. Truy cập ứng dụng
Mở trình duyệt và truy cập: `http://localhost:3000`

## 🎯 Cách sử dụng

### 1. Đăng ký/Đăng nhập
- Tạo tài khoản mới hoặc đăng nhập với tài khoản có sẵn
- Hệ thống sẽ tự động lưu token và duy trì session

### 2. Chat 1-1 (Private Chat)
- Chọn tab "Private" trong sidebar
- Click vào user để bắt đầu chat
- Gửi tin nhắn và nhận phản hồi real-time

### 3. Chat nhóm (Group Chat)
- Chọn tab "Groups" trong sidebar
- Tạo nhóm mới bằng nút "+" 
- Click vào nhóm để tham gia chat
- Tất cả thành viên trong nhóm sẽ nhận được tin nhắn

### 4. Tính năng khác
- **Typing Indicator**: Hiển thị khi ai đó đang gõ
- **Message History**: Tải lại tin nhắn cũ khi vào chat
- **Online Status**: Hiển thị trạng thái online/offline
- **Responsive**: Hoạt động tốt trên mobile

## 🔧 API Endpoints

### Authentication
- `POST /api/register` - Đăng ký user mới
- `POST /api/login` - Đăng nhập

### Users & Rooms
- `GET /api/users` - Lấy danh sách users
- `GET /api/rooms` - Lấy danh sách rooms
- `POST /api/rooms` - Tạo room mới

### Messages
- `GET /api/messages/private/:userId` - Lấy tin nhắn private
- `GET /api/messages/room/:roomId` - Lấy tin nhắn room

## 🔌 Socket Events

### Client → Server
- `private_message` - Gửi tin nhắn private
- `room_message` - Gửi tin nhắn trong room
- `join_room` - Tham gia room
- `leave_room` - Rời room
- `typing_start` - Bắt đầu gõ
- `typing_stop` - Dừng gõ

### Server → Client
- `private_message` - Nhận tin nhắn private
- `room_message` - Nhận tin nhắn room
- `user_online` - User online
- `user_offline` - User offline
- `typing_start` - Ai đó đang gõ
- `typing_stop` - Ai đó dừng gõ

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Messages Table
```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER,        -- NULL for room messages
    room_id TEXT,              -- NULL for private messages
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users (id)
);
```

### Rooms Table
```sql
CREATE TABLE rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users (id)
);
```

### Room Members Table
```sql
CREATE TABLE room_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);
```

## 🎨 Giao diện

### Design Features
- **Modern UI**: Gradient backgrounds, rounded corners
- **Responsive**: Hoạt động trên desktop và mobile
- **Real-time**: Typing indicators, online status
- **Intuitive**: Dễ sử dụng, trực quan

### Color Scheme
- Primary: `#667eea` (Blue gradient)
- Secondary: `#764ba2` (Purple gradient)
- Background: `#f8f9fa` (Light gray)
- Text: `#333` (Dark gray)

## 🔒 Bảo mật

### Authentication
- JWT tokens cho session management
- Password hashing với bcrypt
- Token validation cho socket connections

### Data Protection
- SQL injection prevention với parameterized queries
- Input validation và sanitization
- CORS configuration

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Environment Variables
- `PORT`: Port server (default: 3000)
- `JWT_SECRET`: Secret key cho JWT (thay đổi trong production)

## 📝 Lưu ý

### Development
- Database SQLite được tạo tự động
- Không cần cấu hình database phức tạp
- Hot reload với nodemon

### Production Considerations
- Thay đổi JWT_SECRET
- Sử dụng database production (PostgreSQL, MySQL)
- Cấu hình HTTPS
- Rate limiting
- Logging và monitoring

## 🤝 Contributing

1. Fork dự án
2. Tạo feature branch
3. Commit changes
4. Push to branch
5. Tạo Pull Request

## 📄 License

MIT License - xem file LICENSE để biết thêm chi tiết.

## 🆘 Troubleshooting

### Lỗi thường gặp

**1. Port 3000 đã được sử dụng**
```bash
# Thay đổi port trong server.js
const PORT = process.env.PORT || 3001;
```

**2. Socket connection failed**
- Kiểm tra server đã chạy chưa
- Kiểm tra firewall settings
- Kiểm tra CORS configuration

**3. Database errors**
- Xóa file `chat.db` để tạo lại database
- Kiểm tra quyền write trong thư mục

**4. Authentication issues**
- Xóa localStorage và đăng nhập lại
- Kiểm tra JWT_SECRET trong server.js

## 📞 Support

Nếu có vấn đề hoặc câu hỏi, hãy tạo issue trên GitHub hoặc liên hệ qua email.

---

**Happy Coding! 🎉** 