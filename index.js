// Import dependencies
const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');

// Set up the server
dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the public directory
app.use(express.static('public'));

// Use session middleware
const sessionMiddleware = session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 * 7 },
});
app.use(sessionMiddleware);
// io.use((socket, next) =>
//   sessionMiddleware(socket.request, socket.request.res, next)
// );

io.engine.use(sessionMiddleware);

// Define the fast foods and order history and orderHistory

const fastFoods = {
  2: 'Jollof',
  3: 'Indomie',
  4: 'Poundo',
  5: 'Semo',
};

const orderHistory = [];

const getMenuString = () => {
  return Object.keys(fastFoods)
    .map((key) => `${key}. ${fastFoods[key]}`)
    .join('\n');
};

// Define the socket.io event listeners
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Define the bot message function
  const sendBotMessage = (message) => {
    console.log('Bot message received:', message);
    socket.emit('bot-message', message);
  };

  // Ask for the user's name
  sendBotMessage("Hello! What's your name?");

  // Define the current order
  socket.request.session.currentOrder = [];

  // Define the user name
  let userName = '';

  const handleUserInput = (message) => {
    switch (message) {
      case '1':
        sendBotMessage(
          `Here is a list of items you can order:\n ${getMenuString()}\n Please select one by typing its number.`
        );
        break;
      case '2':
      case '3':
      case '4':
      case '5':
        handleItemSelection(parseInt(message));
        break;
      case '99':
        handleCheckout();
        break;
      case '98':
        handleOrderHistory();
        break;
      case '97':
        handleCurrentOrder();
        break;
      case '0':
        handleOrderCancellation();
        break;
      default:
        sendBotMessage('Invalid selection. Please try again.');
        break;
    }
  };

  const handleItemSelection = (selectedIndex) => {
    if (fastFoods.hasOwnProperty(selectedIndex)) {
      const selectedItem = fastFoods[selectedIndex];
      socket.request.session.currentOrder.push(selectedItem);
      sendBotMessage(
        `${selectedItem} has been added to your order. Do you want to add more items to your order?\n 1. See menu.\n If not, type 99 to checkout.`
      );
    } else {
      sendBotMessage('Invalid selection.');
    }
  };

  const handleCheckout = () => {
    if (socket.request.session.currentOrder.length === 0) {
      sendBotMessage('No order to place. Place an order\n1. See menu');
    } else {
      orderHistory.push(socket.request.session.currentOrder);
      sendBotMessage('Order placed');
      socket.request.session.currentOrder = [];
    }
  };

  const handleOrderHistory = () => {
    if (orderHistory.length === 0) {
      sendBotMessage('No previous orders');
    } else {
      const orderHistoryString = orderHistory
        .map((order, index) => `Order ${index + 1}: ${order.join(', ')}`)
        .join('\n');
      sendBotMessage(`Here is your order history:\n ${orderHistoryString}`);
    }
  };

  const handleCurrentOrder = () => {
    if (socket.request.session.currentOrder.length === 0) {
      sendBotMessage('No current order. Place an order\n1. See menu');
    } else {
      const currentOrderString = socket.request.session.currentOrder.join(', ');
      sendBotMessage(`Here is your current order: ${currentOrderString}`);
    }
  };

  const handleOrderCancellation = () => {
    socket.request.session.currentOrder = [];
    sendBotMessage('Order cancelled. Place a new order\n1. See menu');
  };

  // Listen for incoming user messages
  socket.on('user-message', (message) => {
    console.log('User message received:', message);

    if (!userName) {
      userName = message;
      sendBotMessage(
        `Welcome to the ChatBot, ${userName}!\n1. Place an Order\n99. Checkout\n98. Current Order\n97. Order History \n0. Cancel Order`
      );
    } else {
      handleUserInput(message);
    }
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
