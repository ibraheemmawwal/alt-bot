// Import dependencies
const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const path = require('path');

// Set up the server
dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
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
  100: {
    name: 'Burger',
    price: 100,
  },
  101: {
    name: 'Pizza',
    price: 200,
  },
  102: {
    name: 'Fries',
    price: 50,
  },
  103: {
    name: 'Sandwich',
    price: 150,
  },
  104: {
    name: 'Pasta',
    price: 250,
  },
  105: {
    name: 'Noodles',
    price: 300,
  },
  106: {
    name: 'Biryani',
    price: 400,
  },
  107: {
    name: 'Dosa',
    price: 500,
  },
  109: {
    name: 'Idli',
    price: 600,
  },
  110: {
    name: 'Puri',
    price: 700,
  },
  111: {
    name: 'Chapati',
    price: 800,
  },
  112: {
    name: 'Paratha',
    price: 900,
  },
};

const orderHistory = [];

// Define the menu string return name and price as name@#price
const getMenuString = () => {
  let menuString = '';
  for (const key in fastFoods) {
    menuString += `${key}. ${fastFoods[key].name} @ ₦${fastFoods[key].price}\n`;
  }
  return menuString;
};

// Define the socket.io event listeners
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Define the bot message function
  const sendBotMessage = (message) => {
    console.log('Bot message received:', message);
    socket.emit('bot-message', message);
  };

  // Define the state
  const initialState = {
    selectedMenuItem: null,
    waitingForQuantity: false,
    checkoutConfirmation: false,
  };

  let state = { ...initialState };

  // Ask for the user's name
  sendBotMessage("Hello! What's your name?");

  // Define the current order
  socket.request.session.currentOrder = [];

  // Define the user name
  let userName = '';

  const handleUserInput = (message) => {
    if (state.waitingForQuantity) {
      const quantity = parseInt(message);
      if (isNaN(quantity)) {
        sendBotMessage('Invalid quantity. Please enter a number.');
        return;
      }
      const selectedItem = state.selectedMenuItem;
      const orderItem = {
        name: selectedItem.name,
        quantity: quantity,
        price: selectedItem.price * quantity,
      };
      socket.request.session.currentOrder.push(orderItem);
      sendBotMessage(
        `${quantity}. ${selectedItem.name}@₦${selectedItem.price} =  ₦${
          selectedItem.price * quantity
        } has been added to your cart. Do you want to add more items to your cart?\n 1. See menu.\n99. to checkout. \n00. Main menu`
      );
      // Reset the state
      state = { ...initialState };
    } else if (state.checkoutConfirmation) {
      if (message === '1') {
        // Add the current order to the order history
        orderHistory.push(socket.request.session.currentOrder);
        // Send the order summary
        sendBotMessage(
          'Your order has been placed. Thank you for shopping with us.\n00. Return to Main Menu'
        );
      } else {
        sendBotMessage(
          'Your order has been cancelled. Thank you for shopping with us.\n00. Return to Main Menu'
        );
      }
      // Reset the state
      state = { ...initialState };
      // Reset the current order
      socket.request.session.currentOrder = [];
    } else {
      switch (message) {
        case '1':
          sendBotMessage(
            `Here is a list of items you can order:\n ${getMenuString()}\n Please select one\n00 Return to main menu.`
          );
          break;
        case '100':
        case '101':
        case '102':
        case '103':
        case '104':
        case '105':
        case '106':
        case '107':
        case '108':
        case '109':
        case '110':
        case '111':
        case '112':
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
        case '00':
          handleMainMenu();
          break;
        default:
          sendBotMessage('Invalid selection. Please try again.');
          break;
      }
    }
  };

  const handleItemSelection = (selectedIndex) => {
    if (fastFoods.hasOwnProperty(selectedIndex)) {
      const selectedItem = fastFoods[selectedIndex];
      sendBotMessage(`How many ${selectedItem.name} do you want to order?`);
      // Set the state to keep track of the selected item and wait for the quantity
      state.selectedMenuItem = selectedItem;
      state.waitingForQuantity = true;
    } else {
      sendBotMessage('Invalid selection.');
    }
  };

  const handleCheckout = () => {
    if (socket.request.session.currentOrder.length === 0) {
      sendBotMessage('No order to place. Place an order\n1. See menu');
    } else {
      const totalPrice = socket.request.session.currentOrder.reduce(
        (acc, item) => acc + item.price,
        0
      );
      const orderItems = socket.request.session.currentOrder
        .map((item) => `${item.name} x ${item.quantity} = ₦${item.price}\n`)
        .join(', ');
      sendBotMessage(
        `Order placed \n` +
          `Your order is ${orderItems}\nTotal: ${totalPrice}\n\n` +
          `1. Confirm order\n0. Cancel Order`
      );

      // Set the state to keep track of the checkout confirmation
      state.checkoutConfirmation = true;
    }
  };

  const handleOrderHistory = () => {
    if (orderHistory.length === 0) {
      sendBotMessage('No previous orders');
    } else {
      const orderHistoryString = orderHistory
        .map((order, index) => {
          const totalPrice = order.reduce((acc, item) => acc + item.price, 0);
          return `Order ${index + 1}: ${order.map(
            (item) => `${item.name} x ${item.quantity} = ₦${item.price}.\n`
          )}\nTotal: ${totalPrice}\n`;
        })
        .join('\n');
      sendBotMessage(
        `Here is your order history:\n${orderHistoryString}\n\n00 Return to main menu`
      );
    }
  };

  const handleCurrentOrder = () => {
    if (socket.request.session.currentOrder.length === 0) {
      sendBotMessage('No current order. Place an order\n1. See menu');
    } else {
      const totalPrice = socket.request.session.currentOrder.reduce(
        (acc, item) => acc + item.price,
        0
      );
      const orderItems = socket.request.session.currentOrder.map(
        (item) => `${item.name} x ${item.quantity} = ₦${item.price}.\n`
      );

      sendBotMessage(`Here is your current order:
      
      ${orderItems}\nTotal: ${totalPrice}\n\nDo you want to place this order?\n99. Checkout\n0. Cancel Order\n00. Return to main menu`);
    }
  };

  const handleOrderCancellation = () => {
    socket.request.session.currentOrder = [];
    sendBotMessage(
      'Order cancelled. Place a new order\n1. See menu\n00 Return to main menu'
    );
  };

  const handleMainMenu = () => {
    sendBotMessage(
      `Welcome to the ChatBot, ${userName}!\n1. Place an Order\n99. Checkout\n98. Order History\n97. Current Order\n0. Cancel Order`
    );
  };

  // Listen for incoming user messages
  socket.on('user-message', (message) => {
    console.log('User message received:', message);

    if (!userName) {
      userName = message;
      sendBotMessage(
        `Welcome to the ChatBot, ${userName}!\n1. Place an Order\n99. Checkout\n98. Order History\n97. Current Order \n0. Cancel Order`
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
