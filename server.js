// Init project
const express = require('express');
const app = express();
const TelegramBot = require('node-telegram-bot-api');
// require/import the mongodb native drivers
const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const mongoose = require('mongoose');
// connection URL
const url = process.env.MONGOLAB_URI;      
// connection
const promise_connection = mongoose.connect(url);
let db = mongoose.connection;
// if connection is success
promise_connection.then(function(db){
	console.log('Connected to mongodb');
});


// describe the schema
const Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;
const userSchema = new Schema({
    name: String,
    chatId: String,
    todoItems: []
});
// get the model
const userModel = mongoose.model('telegram-veronika-users', userSchema);

// Handling front-end requests
app.use(express.static('public'));
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});
 
// Token
const token = process.env.TOKEN;
 
// Create a bot
const bot = new TelegramBot(token, {polling: true});

// Timer/interval to check schedule
setInterval(() => {
  const d = new Date();
  const hours = d.getHours() + 3; //MSK +3
  const minutes = d.getMinutes();
  
  userModel.find({}, (err, users) => {
      if(!err) {
        for(let i = 0; i < users.length; i++) {
          for(let j = 0; j < users[i].todoItems.length; j++) {
            const todoItem_hours = users[i].todoItems[j].time.split(":")[0];
            const todoItem_minutes = users[i].todoItems[j].time.split(":")[1];

            if((hours == todoItem_hours) && (minutes == todoItem_minutes)) {
              bot.sendMessage(users[i].chatId, "Reminder: \n" + users[i].todoItems[j]["item_name"]);
            }
          }
        }
      }
    });
  
}, 60000);

// Handling "START" of the bot
bot.onText(/\/start/, (msg) => { 
  bot.sendMessage(msg.chat.id, "Welcome", {
  "reply_markup": {
      "keyboard": [["Add TodoItem", "Delete TodoItem"],   ["Show all items"], ["Cancel"]]
      }
  });   
});

// Handling "ADD TODOITEM" of the bot
bot.onText(/\/add (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const todoItemArr = match[1].split(',');
  
  const todoItem = {
    item_name: todoItemArr[0],
    time: todoItemArr[1]
  };
  
  // Validation of the current todoItem
  const timeFirstPart = (todoItem.time.split(":")[0] >= 0) && (todoItem.time.split(":")[0] <= 23);
  const timeSecondPart = (todoItem.time.split(":")[1] >= 0) && (todoItem.time.split(":")[1] <= 59);
  const nameOfItem = (todoItem["item_name"].length > 0) && (todoItem["item_name"].length < 32);
  // If validation has no errors
  if(timeFirstPart && timeSecondPart && nameOfItem) {
    //save TodoItem in user's array of his TodoItems in DB
    userModel.findOne({name: msg.from.username}, (err, user) => {
      if(user === null) {
         const newUser = new userModel({
          name: msg.from.username,
          chatId: chatId,
          todoItems: [todoItem]
        });
        newUser.save();
      }
      else {
        user.todoItems.push(todoItem);
        user.save();
      }
    });
    const resp = todoItemArr[0] + " - TodoItem has been created!";
    bot.sendMessage(chatId, resp);
  }
  else if(timeFirstPart === false) {
    bot.sendMessage(chatId, "Validation error: \n hours must be >= 0 and <= 23");
  }
  else if(timeSecondPart === false) {
    bot.sendMessage(chatId, "Validation error: \n minutes must be >= 0 and <= 59");      
  }
  else {
    bot.sendMessage(chatId, "Validation error: \n name of TodoItem must be > 0 and < 32 chars");
  }
});


// Handling "DELETE TODOITEM" of the bot
bot.onText(/\/delete (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const todoItemName = match[1];
  
    userModel.findOne({name: msg.from.username}, (err, user) => {
      if(user === null) {
         bot.sendMessage(chatId, "Error: \n you don't have any todoItems \n to delete one of them");
      }
      else {
        let index = null;
        for(let i = 0; i < user.todoItems.length; i++) {
          if(user.todoItems[i]["item_name"] == todoItemName) {
            index = i;
          }
        }
        
        if(index === null) {
          bot.sendMessage(chatId, "You don't have a todoItem \n with a name like this");
        }
        else {
          user.todoItems.splice(index, 1);
          user.save((error) => {
            if (!error) {
              bot.sendMessage(chatId, "TodoItem [" + todoItemName + "] has been deleted");
            }
          });
        }
        
      }
    });
});

// Handling messages from users
bot.on('message', (msg) => {
   /*********************************************/
   // ADD_TODOITEM
   /*********************************************/
    if (msg.text.toString().toLowerCase().indexOf("add todoitem") === 0) {
        bot.sendMessage(msg.chat.id, "Please,\n enter a name of TodoItem \n and the time to remind you \n about this TodoItem \n For example: \n /add Get done homework, 14:00");
    }
   /*********************************************/
   // DELETE_TODOITEM
   /*********************************************/
    if (msg.text.toString().toLowerCase().indexOf("delete todoitem") === 0) {
        bot.sendMessage(msg.chat.id, "/delete NAME_OF_TODOITEM \n For example: \n /delete do homework");
    }
   /*********************************************/
   // SHOW_ALL_ITEMS
   /*********************************************/
    if (msg.text.toString().toLowerCase().indexOf("show all items") === 0) {
        const chatId = msg.chat.id;
        userModel.findOne({name: msg.from.username}, (err, user) => {
          if(user === null) {
             let resp = "You don't have any todoItems";
             bot.sendMessage(chatId, resp);
          }
          else {
            let resp = "";
            for(let i = 0; i < user.todoItems.length; i++) {
              resp = resp + (i+1) + "). " + user.todoItems[i]["item_name"] + " [" + user.todoItems[i]["time"].substring(1) + "]" + "\n";
            }
            bot.sendMessage(chatId, resp);
          }
        });
    }
   /*********************************************/
   // CANCEL
   /*********************************************/
    if (msg.text.toString().toLowerCase().indexOf("cancel") === 0) {
        bot.sendMessage(msg.chat.id, "Cancelled", {
        "reply_markup": {
            "hide_keyboard": true
            }
        });
    }
   /*********************************************/
  
  
  
   /*********************************************/
   // adding TodoItem
   /*********************************************/
   //console.log(msg.text.toString().toLowerCase().match(/(\w+,\d+)/gi));
    if (msg.text.toString().toLowerCase().indexOf("cancel") === 0) {
        bot.sendMessage(msg.chat.id, "Cancelled", {
        "reply_markup": {
            "hide_keyboard": true
            }
        });
    }
   /*********************************************/
  
});


// listen for requests 
const listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
