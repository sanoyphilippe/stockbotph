const
  crypto = require('crypto'),
  request = require('request'),
  mongo = require('mongoskin');

require('./constants.js')();

module.exports = function() {
  this.db = mongo.db(MONGO_URI, {native_parser:true});
  db.bind('companies');
  db.bind('users');
  db.bind('userAccounts');
  /*
   * Message Read Event
   *
   * This event is called when a previously-sent message has been read.
   * https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read
   *
   */
  this.receivedMessageRead = function (event) {
      var senderID = event.sender.id;
      var recipientID = event.recipient.id;

      // All messages before watermark (a timestamp) or sequence have been seen.
      var watermark = event.read.watermark;
      var sequenceNumber = event.read.seq;

      console.log("Received message read event for watermark %d and sequence " +
        "number %d", watermark, sequenceNumber);
    };

  /*
   * Account Link Event
   *
   * This event is called when the Link Account or UnLink Account action has been
   * tapped.
   * https://developers.facebook.com/docs/messenger-platform/webhook-reference/account-linking
   *
   */
  this.receivedAccountLink = function (event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;

    var status = event.account_linking.status;
    var authCode = event.account_linking.authorization_code;

    if (status == "linked") {
      db.users.update({"service.authCode" : authCode }, {'$set':{"fbUserId": senderID, "service.status": status}}, function(err, result) {
          if (err) throw err;
          if (result && result.result.nModified > 0) {
            console.log(result.result.nModified);
            console.log('Linked user!');
            console.log("Received account link event with for user %d with status %s " +
            "and auth code %s ", senderID, status, authCode);

            db.users.findOne({"fbUserId" : senderID }, function(err, user) {
              if (err)
                throw err;
              console.log(user);
              if (user) {
                db.userAccounts.findOne({"$and": [{"email": user.email}, {"fbUserId": senderID}]}, function(err, userAccount) {
                  if (err)
                    throw err;
                  console.log(userAccount);
                  if (userAccount) {
                    var text = "Welcome back " + user.name.firstName + "!\n" + "Your credit balance is " + userAccount.credit + ".";
                    sendTextMessage(senderID, text);
                  } else {
                    db.userAccounts.update({"email": user.email}, {"$set": {"fbUserId": senderID}}, function(err, userAccountUpdate) {
                      if (err) {
                        throw err;
                      }
                      console.log(userAccountUpdate);
                      if (userAccountUpdate.result.nModified > 0) {
                        db.userAccounts.findOne({"fbUserId": senderID}, function(err, entry) {
                          var text = "Welcome " + user.name.firstName + "!\n" + "Your credit balance is " + entry.credit + ".";
                          sendTextMessage(senderID, text);
                          sendNewUserOptions(senderID);
                          //askRiskProfile(senderID)
                        });
                      }
                    });
                  }
                });
              }
            });
          } else {
            console.log('user not found - status not linked');
          }
      });
    } else if (status == "unlinked") {
      db.users.update({ "fbUserId" : senderID }, {'$set':{ "service.status": status} }, function(err, result) {
          if (err) throw err;
          if (result.result.nModified > 0) {
            console.log('Unlinked user!');
            console.log("Received account link event with for user %d with status %s " +
            "and auth code %s ", senderID, status, authCode);
          } else {
            console.log('user not found - failed to set status to unlinked');
          }
      });
    }
  };


  /*
   * Send a button message using the Send API.
   *
   */
  this.sendNewUserOptions = function (recipientId) {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: "Welcome to Peso, your stocks assistant bot!",
            buttons:[{
              type: "web_url",
              url: "https://google.com",
              title: "Tour"
            }, {
              type: "postback",
              title: "Setup account",
              "payload": JSON.stringify({ state: "USER_SETUP", done: false, part: 0, value: 0, divisorValue: 0})
            }]
          }
        }
      }
    };

    callSendAPI(messageData);
  };

  /*
   * Send a text message using the Send API.
   *
   */
  this.sendTextMessage = function (recipientId, messageText, callback) {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        text: messageText,
        metadata: "DEVELOPER_DEFINED_METADATA"
      }
    };

    var done = false;
    while (!done) {
      if (isSendAPIReady) {
        callSendAPI(messageData);
        done = true;
      }
    }
    callback && callback();
  }

  /*
   * Send a message with Quick Reply buttons.
   *
   */
  this.sendQuickReply = function (recipientId, text, quickReplies) {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        text: text,
        quick_replies: quickReplies
      }
    };

    var done = false;
    while (!done) {
      if (isSendAPIReady) {
        callSendAPI(messageData);
        done = true;
      }
    }
  }

  /*
   * Send a message with the account linking call-to-action
   *
   */
  this.sendAccountLinking = function (recipientId) {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: "Welcome. Link your account.",
            buttons:[{
              type: "account_link",
              url: SERVER_URL + "/authorize"
            }]
          }
        }
      }
    };

    var done = false;
    while (!done) {
      if (isSendAPIReady) {
        callSendAPI(messageData);
        done = true;
      }
    }
  }

  this.sendAccountUnlinking = function (recipientId) {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: "Click button to unlink your account.",
            buttons:[{
              type: "account_unlink"
            }]
          }
        }
      }
    };

    var done = false;
    while (!done) {
      if (isSendAPIReady) {
        callSendAPI(messageData);
        done = true;
      }
    }
  }

  this.getUserInfo = function (userId) {
    request({
      uri: 'https://graph.facebook.com/v2.6/'+ userId +'/',
      qs: { fields: "first_name,last_name,profile_pic,locale,timezone,gender",
        access_token: PAGE_ACCESS_TOKEN },
      method: 'GET'

    }, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        // var recipientId = body.recipient_id;
        // var messageId = body.message_id;
        console.log("Got user info: ");
        console.log(body);
      } else if (response && body) {
        console.error("Failed calling Get user info API", response.statusCode, response.statusMessage, body.error);
      } else {
        console.error("Failed calling Get user info API: Unknown error occured");
      }
    });
  }

  /*
   * Call the Send API. The message data goes in the body. If successful, we'll
   * get the message id in a response
   *
   */
  var messageQueue = [];
  this.callSendAPI = function callSendAPI(messageData) {
    messageQueue.push(messageData);
    while(messageQueue.length != 0) {
      var data = messageQueue.shift();
      request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: PAGE_ACCESS_TOKEN },
        method: 'POST',
        json: messageData

      }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          var recipientId = body.recipient_id;
          var messageId = body.message_id;

          if (messageId) {
            console.log("Successfully sent message with id %s to recipient %s",
              messageId, recipientId);
          } else {
          console.log("Successfully called Send API for recipient %s",
            recipientId);
          }
        } else if (response && body) {
          console.error("Failed sending API", response.statusCode, response.statusMessage, body.error);
        } else {
          console.error("Failed sending API: Unknown error occured");
        }
      });
    }
  };

  this.isSendAPIReady = function() {
    if (messageQueue.length == 0) {
      return true;
    } else {
      return false;
    }
  }

  /*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
  this.verifyRequestSignature = function (req, res, buf) {
    var signature = req.headers["x-hub-signature"];

    if (!signature) {
      // For testing, let's log an error. In production, you should throw an
      // error.
      console.error("Couldn't validate the signature.");
    } else {
      var elements = signature.split('=');
      var method = elements[0];
      var signatureHash = elements[1];

      var expectedHash = crypto.createHmac('sha1', APP_SECRET)
                          .update(buf)
                          .digest('hex');

      if (signatureHash != expectedHash) {
        throw new Error("Couldn't validate the request signature.");
      }
    }
  };

  this.randomPrice = function (price, lastModified) {
    var time_now = new Date();
    if (marketIsOpen(time_now)) {
      var tick_size = getTickSize(price);
      var decimalPlaces = getDecimalPlaces(tick_size);
      console.log("decimal places are " + decimalPlaces);
      time_now = time_now.getTime()/1000;
      lastModified = lastModified.getTime()/1000;
      var time_diff_secs = Math.abs(time_now - lastModified);

      var rand_range = Math.log(time_diff_secs)/2;
      var direction = Math.random() < 0.5 ? -1 : 1;
      
      console.log("Power is " + Math.pow(10, decimalPlaces));
      var price_change = (Math.random() * rand_range)/100;
      price_change =  Math.floor((price_change * price) / tick_size);
      price_change = Math.floor((price_change * tick_size * direction)*Math.pow(10, decimalPlaces))/Math.pow(10, decimalPlaces);
      console.log(price_change);

      var new_price = Math.floor((price_change + price) * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);
      return new_price;
    } else {
      return price;
    }
  };

  this.getDecimalPlaces = function(value) {
    var decimalPlaces = value.toString().split(".");
    if (decimalPlaces.length == 2) {
      decimalPlaces = decimalPlaces[1].length;
    } else {
      decimalPlaces = 0;
    }
    return decimalPlaces;
  };

  this.removeExtraDecimals = function (price, tick_size) {
    var decimalPlaces = getDecimalPlaces(tick_size);
    var regulator = Math.pow(10, decimalPlaces);

    price = roundup(price * regulator, decimalPlaces)/regulator;
    return price;
  }

  this.roundup = function (value, decimals) {
    return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
  }

  this.marketIsOpen = function (datetime) {
    const hours = datetime.getHours();
    const minutes = datetime. getMinutes();
    if ((hours == 9 && minutes >= 30) || (hours > 9 && hours < 12)) {
      return true;
    } else if(hours == 13 && minutes > 30) {
      return true;
    } else if ((hours > 13 && hours < 15 ) || (hours == 15 && minutes < 30)) {
      return true;
    } else {
      return false;
    }
  };

  this.getTickSize = function(price) {
    if (price <= 0.0099) {
      return 0.0001;
    } else if (price <= 0.0490) {
      return 0.001;
    } else if (price <= 0.2490) {
      return 0.001;
    } else if (price <= 0.4950) {
      return 0.005;
    } else if (price <= 4.9900) {
      return 0.01;
    } else if (price <= 9.9900) {
      return 0.01;
    } else if (price <= 19.9800) {
      return 0.02;
    } else if (price <= 49.9500) {
      return 0.05;
    } else if (price <= 99.9500) {
      return 0.05;
    } else if (price <= 199.9000) {
      return 0.1;
    } else if (price <= 499.8000) {
      return 0.2;
    } else if (price <= 999.5000) {
      return 0.5;
    } else if (price <= 1999.0000) {
      return 1;
    } else if (price <= 4998.0000) {
      return 2;
    } else if (price >= 5000.0000) {
      return 5;
    }
  };

  this.getLotSize = function(price) {
    if (price <= 0.0099) {
      return 1000000;
    } else if (price <= 0.0490) {
      return 100000;
    } else if (price <= 0.2490) {
      return 10000;
    } else if (price <= 0.4950) {
      return 10000;
    } else if (price <= 4.9900) {
      return 1000;
    } else if (price <= 9.9900) {
      return 100;
    } else if (price <= 19.9800) {
      return 100;
    } else if (price <= 49.9500) {
      return 100;
    } else if (price <= 99.9500) {
      return 10;
    } else if (price <= 199.9000) {
      return 10;
    } else if (price <= 499.8000) {
      return 10;
    } else if (price <= 999.5000) {
      return 10;
    } else if (price <= 1999.0000) {
      return 5;
    } else if (price <= 4998.0000) {
      return 5;
    } else if (price >= 5000.0000) {
      return 5;
    }
  };

  this.getFees = function (state, price, shares) {
    if (!state && !price && !shares) {
      return null
    }

    const sub_total = price * shares;
    const commission = sub_total * 0.0025;
    const vat = commission * 0.12;
    const pseTransFee = sub_total * 0.00005;
    const sccp = sub_total * 0.0001;
    var salesTax = 0;

    if (state == "SELLING_STOCKS") {
     salesTax = sub_total * 0.005; 
    }

    const total_fees = roundup((commission + vat + pseTransFee + sccp + salesTax)*100, 2)/100;
    return total_fees;
  };

  this.formatValue = function(value) {
    if (!isNaN(value)) {
      return removeExtraDecimals(value, getTickSize(value));
    }
    return value;
  };

  /*
  * given a number, returns a comma added string representation
  * of the number
  */
  this.prettifyNumber = function (x) {
    var parts = x.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

  this.isValidPrice = function (price, symbol, callback) {
    if (!isNaN(price)) {
      db.companies.findOne({"symbol": symbol}, function(err, company) {
        if (err)
          callback && callback(err, null);
        if (company) {
          var tick_size = getTickSize(company.currentPrice);
          var decimalPlaces = getDecimalPlaces(tick_size);
          const regulator = Math.pow(10, decimalPlaces);
          var remainder = (regulator * price) % (regulator* tick_size);
          if (remainder == 0) {
            callback && callback(null, true);
          } else {
            callback && callback(null, false);
          }
        } else {
          console.log("company %s not found", symbol);
          callback && callback(new Error("company not found", null));
        }
      });
    } else {
      callback && callback(new Error("Not a number"), null);
    }
  };

  this.isValidAmount = function (amount, symbol, callback) {
    if (!isNaN(amount)) {
      db.companies.findOne({"symbol": symbol}, function(err, company) {
        if (err)
          callback && callback(err, null);
        if (company) {
          var lot_size = getLotSize(company.currentPrice);
          const remainder = amount % lot_size;
          if (remainder == 0) {
            callback && callback(null, true);
          } else {
            callback && callback(null, false);
          }
        } else {
          console.log("company %s not found", symbol);
          callback && callback(new Error("company not found", null));
        }
      });
    } else {
      callback && callback(new Error("Not a number"), null);
    }
  };

}



