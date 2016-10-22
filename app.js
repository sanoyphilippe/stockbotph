/*
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* jshint node: true, devel: true */
'use strict';

const
  bodyParser = require('body-parser'),
  config = require('config'),
  crypto = require('crypto'),
  express = require('express'),
  https = require('https'),
  request = require('request'),
  mongo = require('mongoskin'),
  hbs = require('hbs');

//require('./utils.js')();

require('./states.js')();

var app = express();
var authCodes = {};
app.set('port', process.env.PORT || 5000);
app.set('view engine', 'html');
app.engine('html', require('hbs').__express);
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(express.static('public'));

hbs.registerPartials(__dirname + '/views', function(e) {
  if (e) {
    throw e;
  }
  console.log("Successfully loaded partials");
});

//require('./constants.js')();

/*
 * Use your own validation token. Check that the token used in the Webhook
 * setup is the same token used here.
 *
 */
console.log("starting application");
console.log(APP_SECRET)
console.log(VALIDATION_TOKEN)
console.log(PAGE_ACCESS_TOKEN)
console.log(SERVER_URL)
app.get('/', function(req, res) {
  console.log("Validating token");
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});


/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page.
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */
app.post('/', function (req, res) {
  var data = req.body;
  console.log("Validating token");

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        } else if (messagingEvent.read) {
          receivedMessageRead(messagingEvent);
        } else if (messagingEvent.account_linking) {
          receivedAccountLink(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

app.post('/login', function(req, res) {
    console.log('User logging in');
    console.dir('email: ' + req.body.email +  ' pass: ' + req.body.password);
    const email = req.body.email,
        password = req.body.password,
        authCode = req.body.authCode;

    console.log("login authCode: " + authCode);
    db.users.findOne({
      "email": email,
      "password": password
    }, function(err, result) {
      if (err)
        throw err;
      if (result) {
        db.users.update({"email": result.email}, {"$set": {"service.authCode": authCode}}, function(err, result) {
          if (err)
            throw err;
          if (result.result.nModified > 0) {
            res.sendStatus(200);
          } else {
            res.sendStatus(404);    
          }
        });
      } else {
        res.sendStatus(404);
      }
    });
});

app.post('/register', function(req, res) {
    console.log('User Registration');
    console.dir('email: ' + req.body.email +  ' pass: ' + req.body.password);
    console.log(req.body);
    const email = req.body.email,
        password = req.body.password,
        fName = req.body.fName,
        mName = req.body.mName,
        lName = req.body.lName,
        authCode = req.body.authCode;
    console.log("registration authCode: " + authCode);
    console.log("registration authCode: " + req.body.authCode);

    db.users.insert({
      "email": email,
      "password": password,
      "name": {
        "firstName": fName,
        "middleName": mName,
        "lastName": lName
      },
      "service": {
        "authCode": authCode
      }
    }, function(err, result) {
      if (err)
        throw err;
      if (result) {
        db.userAccounts.insert({ 
          "email": email, 
          "credit":  100000
        }, function(err, result) {
          if (err) {
            db.users.remove({"email": email});
            throw err;
          }
          if (result) {
            res.sendStatus(200);
          }
        });
      }
      else {
        res.sendStatus(404);
      }
    });
    //var redirectURI = req.body.redirect.replace(/http/, 'https');
    //console.log(redirectURI);
});

/*
 * This path is used for account linking. The account linking call-to-action
 * (sendAccountLinking) is pointed to this URL.
 *
 */
app.get('/authorize', function(req, res) {
  console.log("Validating token");
  var accountLinkingToken = req.query.account_linking_token;
  var redirectURI = req.query.redirect_uri;

  // Authorization Code should be generated per user by the developer. This will
  // be passed to the Account Linking callback.
  var authCode = new Buffer(accountLinkingToken + new Date().toLocaleString()).toString('base64');
  // authCodes[authCode] = authCode;
  // console.log("Stored in authCodes: " + authCodes[authCode]);

  console.log("user with authCode: " + authCode);

  // Redirect users to this URI on successful login
  var redirectURISuccess = redirectURI + "&authorization_code=" + authCode;

  res.render('login', {
    authCode: authCode,
    accountLinkingToken: accountLinkingToken,
    redirectURI: redirectURI,
    redirectURISuccess: redirectURISuccess
  });
});



/*
 * Authorization Event
 *
 * The value for 'optin.ref' is defined in the entry point. For the "Send to
 * Messenger" plugin, it is the 'data-ref' field. Read more at
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/authentication
 *
 */
function receivedAuthentication(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfAuth = event.timestamp;

  // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
  // The developer can set this to an arbitrary value to associate the
  // authentication callback with the 'Send to Messenger' click event. This is
  // a way to do account linking when the user clicks the 'Send to Messenger'
  // plugin.
  var passThroughParam = event.optin.ref;

  console.log("Received authentication for user %d and page %d with pass " +
    "through param '%s' at %d", senderID, recipientID, passThroughParam,
    timeOfAuth);

  // When an authentication is received, we'll send a message back to the sender
  // to let them know it was successful.
  sendTextMessage(senderID, "Authentication successful");
}

/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message'
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 *
 * For this example, we're going to echo any text that we get. If we get some
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've
 * created. If we receive a message with an attachment (image, video, audio),
 * then we'll simply confirm that we've received the attachment.
 *
 */
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:",
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var isEcho = message.is_echo;
  var messageId = message.mid;
  var appId = message.app_id;
  var metadata = message.metadata;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;
  var quickReply = message.quick_reply;

  if (isEcho) {
    // Just logging message echoes to console
    console.log("Received echo for message %s and app %d with metadata %s",
      messageId, appId, metadata);
    return;
  } else if (quickReply) {
    var payload = JSON.parse(quickReply.payload);
    console.log("Quick reply for message %s with payload %s",
      messageId, payload);
    states(senderID, payload);
    return;
  }

  if (messageText) {
    //getUserInfo(senderID);
    // If we receive a text message, check to see if it matches any special
    // keywords and send back the corresponding example. Otherwise, just echo
    // the text we received.
    var wordList = messageText.split(" ");
    console.log(messageText);
    console.log(wordList);
    switch (wordList[0].toLowerCase()) {
      case 'quote':
        if (wordList.length == 2) {
          sendStockInfo(senderID, wordList[1].toUpperCase());
        }
        break;
      case 'buy':
        if (wordList.length == 2) {
          db.companies.findOne({"symbol": wordList[1].toUpperCase()}, function(err, company){
            if (err)
              throw err;
            if (company) {
              var payload = {
                state: "BUYING_STOCKS",
                part: 0,
                recipient: {
                  id: senderID
                },
                companyId: company._id,
                companyName: company.name,
                companySymbol: company.symbol
              };
              states(senderID, payload);
            }
          });
        }
        break;

      case 'sell':
        if (wordList.length == 2) {
          db.companies.findOne({"symbol": wordList[1].toUpperCase()}, function(err, company){
            if (err)
              throw err;
            if (company) {
              var payload = {
                state: "SELLING_STOCKS",
                part: 0,
                recipient: {
                  id: senderID
                },
                companyId: company._id,
                companyName: company.name,
                companySymbol: company.symbol
              };
              states(senderID, payload);
            }
          });
        }
        break;
      case 'logout':
        if (wordList.length == 1) {
          db.users.findOne({ "$and": [{"fbUserId": senderID}, {"service.status": "unlinked"}]}, function(err, user) {
            if (err)
              throw err;
            console.log(" in logout case");
            console.log(user);
            if (!user) {
              sendAccountUnlinking(senderID);
            }
          });
        }
        break;
      
      case 'login':
        if (wordList.length == 1) {
          db.users.findOne({ "$and": [{"fbUserId": senderID}, {"service.status": "linked"}]}, function(err, user) {
            if (err)
              throw err;
            console.log(" in login case");
            console.log(user);
            if (!user) {
              sendAccountLinking(senderID);
            }
          });
        }
        break;
      case 'help':
        if (wordList.length == 2) {
          switch(wordList[1].toLowerCase()) {
            case 'quote':
              var text = "quote <stock_ticker_symbol> :\nThis command shows information about specific comapny stocks.\n"
                    + "<stock_ticker_symbol> should be the given symbol for that specific company.\n"
                    + "i.e. BPI (for Bank of the Philippine Islands)";
              sendTextMessage(senderID, text);
              break;
            case 'buy':
              var text = "buy <stock_ticker_symbol> :\nThis command initiates buying of stocks for the specified company.\n"
                    + "This will also show how much credit you have in your account,\nthe maximum number of shares you can buy,"
                    + "\nand the number of shares you have for this company.";
              sendTextMessage(senderID, text);
              break;
            case 'sell':
              var text = "sell <stock_ticker_symbol> :\nThis command initiates selling of stocks for the specified company.\n"
                    + "This will also show how much credit you have in your account,\nthe maximum number of shares you can sell,"
                    + "\nand the number of shares you have for this company.";
              sendTextMessage(senderID, text);
              break;
          }
        }
        break;
      default:
        console.log("In default");
        db.users.findOne({"fbUserId": senderID, "$or": [{"payload.state": "BUYING_STOCKS"}, {"payload.state": "SELLING_STOCKS"}]}, function(err, user) {
          if (err) {
            console.log(user)
            throw err;
          }
          console.log("In db search");
          console.log(user)
          if (user) {
            switch(user.payload.state) {
              case "BUYING_STATE":
                switch(user.payload.part) {
                  case 0:
                    var buyingPrice = parseFloat(wordList[0]);

                    if (!isNaN(buyingPrice)) {
                      isValidPrice(buyingPrice, user.payload.companySymbol, function(err, result) {
                        if (err) {
                          sendTextMessage(senderID, "An error occured.");
                          states(senderID, user.payload);
                          throw err;
                        }
                        if (result) {
                          var payload = {
                                  state: "BUYING_STOCKS",
                                  part: 1,
                                  buyingPrice: formatValue(buyingPrice),
                                  recipient: {
                                    id: senderID
                                  },
                                  companyId: user.payload.companyId,
                                  companyName: user.payload.companyName,
                                  companySymbol: user.payload.companySymbol
                                };
                          states(senderID, payload);
                        } else {
                          sendTextMessage(senderID, "Invalid price value.");
                          states(senderID, user.payload);
                        }
                      });
                    } else {
                      sendTextMessage(senderID, "Invalid price value.");
                      states(senderID, user.payload);
                    }
                    break;

                  case 1:
                    var sharesAmount = parseInt(wordList[0]);
                    if (!isNaN(sharesAmount)) {
                      isValidAmount(sharesAmount, user.payload.companySymbol, function(err, result) {
                        if (err) {
                          sendTextMessage(senderID, "Invalid amount value.");
                          states(senderID, user.payload);
                          throw err;
                        }
                        if (result) {
                          var payload = {
                                state: "BUYING_STOCKS",
                                part: 2,
                                buyingPrice: user.payload.buyingPrice,
                                sharesAmount: sharesAmount,
                                recipient: {
                                  id: senderID
                                },
                                companyId: user.payload.companyId,
                                companyName: user.payload.companyName,
                                companySymbol: user.payload.companySymbol
                              };
                          states(senderID, payload);
                        } else {
                          sendTextMessage(senderID, "Invalid amount value.");
                          states(senderID, user.payload);
                        }
                      });  
                    } else {
                      sendTextMessage(senderID, "Invalid amount value.");
                      states(senderID, user.payload);
                    }
                    break;
                  default:
                    states(senderID, user.payload);
                }
                break;
              case "SELLING_STATE":
                switch(user.payload.part) {
                  case 0:
                    var sellingPrice = parseFloat(wordList[0]);

                    if (!isNaN(sellingPrice)) {
                      isValidPrice(sellingPrice, user.payload.companySymbol, function(err, result) {
                        if (err) {
                          sendTextMessage(senderID, "An error occured.");
                          states(senderID, user.payload);
                          throw err;
                        }
                        if (result) {
                          var payload = {
                                  state: "SELLING_STOCKS",
                                  part: 1,
                                  sellingPrice: formatValue(sellingPrice),
                                  recipient: {
                                    id: senderID
                                  },
                                  companyId: user.payload.companyId,
                                  companyName: user.payload.companyName,
                                  companySymbol: user.payload.companySymbol
                                };
                          states(senderID, payload);
                        } else {
                          sendTextMessage(senderID, "Invalid price value.");
                          states(senderID, user.payload);
                        }
                      });
                    } else {
                      sendTextMessage(senderID, "Invalid price value.");
                      states(senderID, user.payload);
                    }
                    break;

                  case 1:
                    var sharesAmount = parseInt(wordList[0]);
                    if (!isNaN(buyingPrice)) {
                      isValidAmount(sharesAmount, user.payload.companySymbol, function(err, result) {
                        if (err) {
                          sendTextMessage(senderID, "Invalid amount value.");
                          states(senderID, user.payload);
                          throw err;
                        }
                        if (result) {
                          if (user.stocks && (sharesAmount > user.stocks[user.payload.companySymbol])) {
                            sendTextMessage(senderID, "You do not have that amount.");
                            states(senderID, user.payload);
                          } else if (user.stocks) {
                            var payload = {
                                state: "SELLING_STOCKS",
                                part: 2,
                                sellingPrice: user.payload.sellingPrice,
                                sharesAmount: sharesAmount,
                                recipient: {
                                  id: senderID
                                },
                                companyId: user.payload.companyId,
                                companyName: user.payload.companyName,
                                companySymbol: user.payload.companySymbol
                              };
                            states(senderID, payload);
                          }
                        } else {
                          sendTextMessage(senderID, "Invalid amount value.");
                          states(senderID, user.payload);
                        }
                      });  
                    } else {
                      sendTextMessage(senderID, "Invalid amount value.");
                      states(senderID, user.payload);
                    }
                    break;
                  default:
                    states(senderID, user.payload);
                }
                break;
            }
          } else {
            sendTextMessage(senderID, "I'm sorry I did not recognize your command.");
          }
        });
    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}


/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 *
 */
function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log("Received delivery confirmation for message ID: %s",
        messageID);
    });
  }

  console.log("All message before %d were delivered.", watermark);
}


/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 *
 */
function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback
  // button for Structured Messages.
  var payload = JSON.parse(event.postback.payload);

  states(senderID, payload);

  console.log("Received postback for user %d and page %d with payload '%s' " +
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to
  // let them know it was successful
  //sendTextMessage(senderID, "Postback called");
}

/*
 * Send an image using the Send API.
 *
 */
function sendImageMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: SERVER_URL + "/assets/rift.png"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a Gif using the Send API.
 *
 */
function sendGifMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: SERVER_URL + "/assets/instagram_logo.gif"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send audio using the Send API.
 *
 */
function sendAudioMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "audio",
        payload: {
          url: SERVER_URL + "/assets/sample.mp3"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a video using the Send API.
 *
 */
function sendVideoMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "video",
        payload: {
          url: SERVER_URL + "/assets/allofus480.mov"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a file using the Send API.
 *
 */
function sendFileMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "file",
        payload: {
          url: SERVER_URL + "/assets/test.txt"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a button message using the Send API.
 *
 */
function sendButtonMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "This is test text",
          buttons:[{
            type: "web_url",
            url: "https://www.oculus.com/en-us/rift/",
            title: "Open Web URL"
          }, {
            type: "postback",
            title: "Trigger Postback",
            payload: "DEVELOPED_DEFINED_PAYLOAD"
          }, {
            type: "phone_number",
            title: "Call Phone Number",
            payload: "+16505551234"
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send the stock info with buy and sell buttons
 * using the Send API.
 *
 */
function sendStockInfo(recipientId, tickerSymbol) {
  db.companies.findOne({"symbol": tickerSymbol}, function(err, company) {
    if (err)
      throw err;
    if (company) {
      var oldPrice = company.previousClose;
      var newPrice = randomPrice(company.currentPrice, company.lastModifiedAt);
      db.companies.update({"symbol": tickerSymbol}, {"$set": {"currentPrice": newPrice, "lastModifiedAt": new Date()}}, function(err, result) {
        if (err)
          throw err;
        console.log(result.result.nModified);
        if (result.result.nModified > 0) {
          console.log("Updated price of stock");
          db.companies.findOne({"symbol": tickerSymbol}, function(err, company) {
            if (err)
              throw err;
            console.log(company);
            if (company) {
              db.userAccounts.findOne({"fbUserId": recipientId},function(err, user) {
                if (err)
                  throw err;
                if (user) {
                  var textInfo = company.name + " (" + company.symbol + ")"
                    + "\nCurrent Price: " + company.currentPrice
                    + "\nOpen: " + oldPrice
                    + "\nPrevious Close: " + company.previousClose
                    + "\n52 Week High: " + company['52WeekHigh']
                    + "\n52 Week Low: " + company['52WeekLow']
                    + "\nPE: " + company.pe;
                  if (user.stocks) {
                    if (user.stocks[tickerSymbol]) {
                      textInfo += "\nYour stocks: " + user.stocks[tickerSymbol];
                    }
                  }

                  var messageData = {
                    recipient: {
                      id: recipientId
                    },
                    message: {
                      attachment: {
                        type: "template",
                        payload: {
                          template_type: "button",
                          text: textInfo,
                          buttons:[{
                            type: "postback",
                            title: "Buy",
                            payload: JSON.stringify({
                              state: "BUYING_STOCKS",
                              part: 0,
                              recipient: {
                                id: recipientId
                              },
                              companyId: company._id,
                              companyName: company.name,
                              companySymbol: company.symbol
                            })
                          }, {
                            type: "postback",
                            title: "Sell",
                            payload: JSON.stringify({
                              state: "SELLING_STOCKS",
                              part: 0,
                              recipient: {
                                id: recipientId
                              },
                              companyId: company._id,
                              companyName: company.name,
                              companySymbol: company.symbol
                            })
                          }]
                        }
                      }
                    }
                  };

                  callSendAPI(messageData);
                }
              });
            }
          });
        }
      });
    }
  });
}

/*
 * Send a Structured Message (Generic Message type) using the Send API.
 *
 */
function sendGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality",
            item_url: "https://www.oculus.com/en-us/rift/",
            image_url: SERVER_URL + "/assets/SMC.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble",
            }],
          }, {
            title: "touch",
            subtitle: "Your Hands, Now in VR",
            item_url: "https://www.oculus.com/en-us/touch/",
            image_url: SERVER_URL + "/assets/touch.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a receipt message using the Send API.
 *
 */
function sendReceiptMessage(recipientId) {
  // Generate a random receipt ID as the API requires a unique ID
  var receiptId = "order" + Math.floor(Math.random()*1000);

  var messageData = {
    recipient: {
      id: recipientId
    },
    message:{
      attachment: {
        type: "template",
        payload: {
          template_type: "receipt",
          recipient_name: "Peter Chang",
          order_number: receiptId,
          currency: "USD",
          payment_method: "Visa 1234",
          timestamp: "1428444852",
          elements: [{
            title: "Oculus Rift",
            subtitle: "Includes: headset, sensor, remote",
            quantity: 1,
            price: 599.00,
            currency: "USD",
            image_url: SERVER_URL + "/assets/riftsq.png"
          }, {
            title: "Samsung Gear VR",
            subtitle: "Frost White",
            quantity: 1,
            price: 99.99,
            currency: "USD",
            image_url: SERVER_URL + "/assets/gearvrsq.png"
          }],
          address: {
            street_1: "1 Hacker Way",
            street_2: "",
            city: "Menlo Park",
            postal_code: "94025",
            state: "CA",
            country: "US"
          },
          summary: {
            subtotal: 698.99,
            shipping_cost: 20.00,
            total_tax: 57.67,
            total_cost: 626.66
          },
          adjustments: [{
            name: "New Customer Discount",
            amount: -50
          }, {
            name: "$100 Off Coupon",
            amount: -100
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a read receipt to indicate the message has been read
 *
 */
function sendReadReceipt(recipientId) {
  console.log("Sending a read receipt to mark message as seen");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "mark_seen"
  };

  callSendAPI(messageData);
}

/*
 * Turn typing indicator on
 *
 */
function sendTypingOn(recipientId) {
  console.log("Turning typing indicator on");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_on"
  };

  callSendAPI(messageData);
}

/*
 * Turn typing indicator off
 *
 */
function sendTypingOff(recipientId) {
  console.log("Turning typing indicator off");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_off"
  };

  callSendAPI(messageData);
}



// Start server
// Webhooks must be available via SSL with a certificate signed by a valid
// certificate authority.
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

module.exports = app;

