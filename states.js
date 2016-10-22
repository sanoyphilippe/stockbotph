require('./utils.js')();

module.exports = function() {
	this.states = function(senderID, payload) {
		if (payload) {
      db.users.update({'fbUserId': senderID}, {"$set": {"payload": payload}}, function(err, user) {
        if (err)
          throw err;
        if (user) {
          switch (payload.state) {
            case 'USER_SETUP':
              db.users.update({"fbUserId": senderID}, {"$inc": {"riskPreferenceValue": payload.value, "riskDivisor": payload.divisorValue}}, function(err, result) {
                if (err)
                  throw err;
                console.log("updated user preference value")
              });
              switch(payload.part) {
                case 0:
                  var text = "How many years have you been trading?";
                  var quickReplies = [
                    {
                      "content_type":"text",
                      "title":"< 1",
                      "payload": JSON.stringify({ state: "USER_SETUP", done: false, part: payload.part + 1, value: 1, divisorValue: 1})
                    },
                    {
                      "content_type":"text",
                      "title":"1-3",
                      "payload": JSON.stringify({ state: "USER_SETUP", done: false, part: payload.part + 1, value: 2, divisorValue: 1})
                    },
                    {
                      "content_type":"text",
                      "title":"more than 3",
                      "payload": JSON.stringify({ state: "USER_SETUP", done: false, part: payload.part + 1, value: 3, divisorValue: 1})
                    }
                  ];
                  sendQuickReply(senderID, text, quickReplies);
                  break;

                case 1:
                  var text = "What do you want to achieve from your investment?" 
                  + "\n- preserve capital or real value of investments (safe)"
                  + "\n- achieve balanced growth (safe)"
                  + "\n- achieve significant growth (risky)";
                  var quickReplies = [
                    {
                      "content_type":"text",
                      "title":"preserve",
                      "payload": JSON.stringify({ state: "USER_SETUP", done: false, part: payload.part + 1, value: 1, divisorValue: 1})
                    },
                    {
                      "content_type":"text",
                      "title":"balanced",
                      "payload": JSON.stringify({ state: "USER_SETUP", done: false, part: payload.part + 1, value: 2, divisorValue: 1})
                    },
                    {
                      "content_type":"text",
                      "title":"significant",
                      "payload": JSON.stringify({ state: "USER_SETUP", done: false, part: payload.part + 1, value: 3, divisorValue: 1})
                    }
                  ];
                  sendQuickReply(senderID, text, quickReplies);
                  break;

                case 2:
                  var text = "What portion of your investment\ncan be placed in medium or long term investments?\ni.e., more than 3 years";
                  var quickReplies = [
                    {
                      "content_type":"text",
                      "title":"< 30%",
                      "payload": JSON.stringify({ state: "USER_SETUP", done: false, part: payload.part + 1, value: 1, divisorValue: 1})
                    },
                    {
                      "content_type":"text",
                      "title":"30-70",
                      "payload": JSON.stringify({ state: "USER_SETUP", done: false, part: payload.part + 1, value: 2, divisorValue: 1})
                    },
                    {
                      "content_type":"text",
                      "title":"70-100",
                      "payload": JSON.stringify({ state: "USER_SETUP", done: false, part: payload.part + 1, value: 3, divisorValue: 1})
                    }
                  ];
                  sendQuickReply(senderID, text, quickReplies);
                  break;

                case 3:
                  var text = "When and how often do you plan to cash in on your investments?";
                  var quickReplies = [
                    {
                      "content_type":"text",
                      "title":"Regularly",
                      "payload": JSON.stringify({ state: "USER_SETUP", done: true, part: 4, value: 1, divisorValue: 1})
                    },
                    {
                      "content_type":"text",
                      "title":"1-3 years",
                      "payload": JSON.stringify({ state: "USER_SETUP", done: true, part: 4, value: 2, divisorValue: 1})
                    },
                    {
                      "content_type":"text",
                      "title":"> 3 years",
                      "payload": JSON.stringify({ state: "USER_SETUP", done: true, part: 4, value: 3, divisorValue: 1})
                    }
                  ];
                  sendQuickReply(senderID, text, quickReplies);
                  break;

                case 4:
                  var text = [
                    "You have finished setting up your account!\nHere are the list of commands you can use to interact with Peso.",
                    "quote <stock_ticker_symbol> :\nThis command shows information about specific comapny stocks.\n"
                    + "<stock_ticker_symbol> should be the given symbol for that specific company.\n"
                    + "i.e. BPI (for Bank of the Philippine Islands)",
                    "buy <stock_ticker_symbol> :\nThis command initiates buying of stocks for the specified company.\n"
                    + "This will also show how much credit you have in your account,\nthe maximum number of shares you can buy,"
                    + "\nand the number of shares you have for this company.",
                    "sell <stock_ticker_symbol> :\nThis command initiates selling of stocks for the specified company.\n"
                    + "This will also show how much credit you have in your account,\nthe maximum number of shares you can sell,"
                    + "\nand the number of shares you have for this company."
                    ];
                  sendTextMessage(senderID, text[0]);
                  for (var i = 100000000000; i >= 0; i--) {
                  }
                  sendTextMessage(senderID, text[1]);
                  for (var i = 100000000000; i >= 0; i--) {
                  }
                  sendTextMessage(senderID, text[2]);
                  for (var i = 100000000000; i >= 0; i--) {
                  }
                  sendTextMessage(senderID, text[3]);
                  break;
              }
              break;

            case "BUYING_STOCKS":
            	console.log("Buying stocks");
            	db.companies.findOne({ "symbol": payload.companySymbol }, function(err, company) {
            		if (err)
            			throw err;
            		if (company) {
            			db.userAccounts.findOne({"fbUserId": senderID}, function(err, user) {
            				if (err)
            					throw err;
            				if (user) {
            					const tick_size = getTickSize(company.currentPrice);
		            			const lot_size = getLotSize(company.currentPrice);
		            			const max_transactions = Math.floor(user.credit / (lot_size * company.currentPrice));

            					switch(payload.part) {
				            		case 0:
				            			var text = company.symbol + " is trading at "
				            			+ prettifyNumber(company.currentPrice) + "."
				            			+ "\nYou have PHP " + prettifyNumber(user.credit)
				            			+ "and can buy up to " + max_transactions * lot_size + " shares.";
				            			
				            			if (user.stocks) {
				            				if (user.stocks[company.currentSymbol]) {
				            					text += "\nYou have " + user.stocks[company.currentSymbol] + " shares of " + company.symbol + ".";
				            				}
				            			}
				            			//sendTextMessage(senderID, text);
				            			var textInfo = text + "\n\nAt what price would you like to purchase stocks from " 
			            				+ company.symbol + "?";
			            				var quickReplies = [
				                    {
				                      content_type:"text",
				                      title: "" + company.currentPrice,
				                      payload: JSON.stringify({
	                              state: "BUYING_STOCKS",
	                              part: 1,
	                              buyingPrice: company.currentPrice,
	                              recipient: {
	                                id: senderID
	                              },
	                              companyId: company._id,
	                              companyName: company.name,
	                              companySymbol: company.symbol
	                            })
				                    },
				                    {
				                      "content_type":"text",
				                      "title": "" + removeExtraDecimals(company.currentPrice - tick_size, tick_size),
				                      payload: JSON.stringify({
	                              state: "BUYING_STOCKS",
	                              part: 1,
	                              buyingPrice: removeExtraDecimals(company.currentPrice - tick_size, tick_size),
	                              recipient: {
	                                id: senderID
	                              },
	                              companyId: company._id,
	                              companyName: company.name,
	                              companySymbol: company.symbol
	                            })
				                    },
				                    {
				                      "content_type":"text",
				                      "title": "" + removeExtraDecimals(company.currentPrice - tick_size * 2, tick_size),
				                      payload: JSON.stringify({
	                              state: "BUYING_STOCKS",
	                              part: 1,
	                              buyingPrice: removeExtraDecimals(company.currentPrice - tick_size * 2, tick_size),
	                              recipient: {
	                                id: senderID
	                              },
	                              companyId: company._id,
	                              companyName: company.name,
	                              companySymbol: company.symbol
	                            })
				                    }
				                  ];
				                  sendQuickReply(senderID, textInfo, quickReplies);
				            			break;
				            		case 1:
				            			var textInfo = "How many shares would you like to buy?";
			            				var quickReplies = [
				                    {
				                      content_type:"text",
				                      title: "" + max_transactions * lot_size,
				                      payload: JSON.stringify({
	                              state: "BUYING_STOCKS",
	                              part: 2,
	                              buyingPrice: payload.buyingPrice,
	                              sharesAmount: max_transactions * lot_size,
	                              recipient: {
	                                id: senderID
	                              },
	                              companyId: company._id,
	                              companyName: company.name,
	                              companySymbol: company.symbol
	                            })
				                    },
				                    {
				                      "content_type":"text",
				                      "title": "" + (Math.floor(max_transactions/2)) * lot_size,
				                      payload: JSON.stringify({
	                              state: "BUYING_STOCKS",
	                              part: 2,
	                              buyingPrice: payload.buyingPrice,
	                              sharesAmount: (Math.floor(max_transactions/2)) * lot_size,
	                              recipient: {
	                                id: senderID
	                              },
	                              companyId: company._id,
	                              companyName: company.name,
	                              companySymbol: company.symbol
	                            })
				                    },
				                    {
				                      "content_type":"text",
				                      "title": "" + (Math.floor(max_transactions/3)) * lot_size,
				                      payload: JSON.stringify({
	                              state: "BUYING_STOCKS",
	                              part: 2,
	                              buyingPrice: payload.buyingPrice,
	                              sharesAmount: (Math.floor(max_transactions/3)) * lot_size,
	                              recipient: {
	                                id: senderID
	                              },
	                              companyId: company._id,
	                              companyName: company.name,
	                              companySymbol: company.symbol
	                            })
				                    },
				                    {
				                      "content_type":"text",
				                      "title": "" + (Math.floor(max_transactions/4)) * lot_size,
				                      payload: JSON.stringify({
	                              state: "BUYING_STOCKS",
	                              part: 2,
	                              buyingPrice: payload.buyingPrice,
	                              sharesAmount: (Math.floor(max_transactions/4)) * lot_size,
	                              recipient: {
	                                id: senderID
	                              },
	                              companyId: company._id,
	                              companyName: company.name,
	                              companySymbol: company.symbol
	                            })
				                    }
				                  ];
				                  sendQuickReply(senderID, textInfo, quickReplies);
				            			break;
				            		case 2:
				            			const fees = getFees(payload.state, payload.buyingPrice, payload.sharesAmount);
				            			const total = roundup(((payload.buyingPrice * payload.sharesAmount) + fees) * 100, 2)/100;
				            			var textInfo = "Buying stocks of " + company.symbol
				            				+ "\nPrice: " + payload.buyingPrice
				            				+ "\nShares: " + payload.sharesAmount
				            				+ "\nFees: " + fees
				            				+ "\nTotal: " + total;
			            				var quickReplies = [
				                    {
				                      content_type:"text",
				                      title: "Confirm",
				                      payload: JSON.stringify({
	                              state: "BUYING_STOCKS",
	                              part: 3,
	                              buyingPrice: payload.buyingPrice,
	                              sharesAmount: payload.sharesAmount,
	                              fees: fees,
	                              total: total,
	                              recipient: {
	                                id: senderID
	                              },
	                              companyId: company._id,
	                              companyName: company.name,
	                              companySymbol: company.symbol
	                            })
				                    },
				                    {
				                      "content_type":"text",
				                      "title": "Cancel",
				                      payload: JSON.stringify({
	                              state: "IDLE",
	                              part: 0
	                            })
				                    }
				                  ];
				                  sendQuickReply(senderID, textInfo, quickReplies);
				            			break;
				            		case 3:
				            			var text = "Please wait while I process your transaction."
				            			sendTextMessage(senderID, text, function(err, result) {
				            				var query = {}
				            				query["stocks." + payload.companySymbol] = payload.sharesAmount;
				            				query["credit"] = payload.total * -1;

				            				db.userAccounts.update({"fbUserId": senderID}, 
				            					{
				            						"$inc": query
				            					}, function(err, result) {
				            						if (err)
				            							throw err;
				            						if (result.result.nModified > 0) {
				            							db.userAccounts.findOne({"fbUserId": senderID}, function(err, user) {
				            								if (err)
				            									throw err;
				            								if (user) {
				            									text = "Success! you bought " + payload.sharesAmount 
				            										+ " shares of " + company.symbol
				            										+ "\nYou now have " + user.stocks[company.symbol] + " shares of "
				            										+ company.symbol;
				            									sendTextMessage(senderID, text, function(err, result) {
				            										if (err)
				            											throw err;
				            										db.users.update({"fbUserId": senderID}, 
				            											{
				            												"$set": {
				            													"payload": JSON.stringify({
				            														state: "IDLE",
				            														part: 0
				            													})
				            												}
				            											});
				            									});
				            								}
				            							});
				            						}
				            					});
				            			});
				            			break;
				            	}
            				}
	            		});
            		}
            	});
              break;

            case "SELLING_STOCKS":
            	console.log("Selling stocks");
            	db.companies.findOne({ "symbol": payload.companySymbol }, function(err, company) {
            		if (err)
            			throw err;
            		if (company) {
            			var query = {}
            			query["stocks."+ payload.companySymbol] = { "$ne": null };
            			db.userAccounts.findOne({"$and": [{"fbUserId": senderID}, query]}, function(err, user) {
            				if (err)
            					throw err;
            				if (user) {
            					const tick_size = getTickSize(company.currentPrice);
		            			const lot_size = getLotSize(company.currentPrice);
		            			const max_transactions = Math.floor(user.stocks[company.symbol] / lot_size);

            					switch(payload.part) {
				            		case 0:
				            			var text = company.symbol + " is trading at "
				            			+ prettifyNumber(company.currentPrice) + "."
				            			+ "\nYou can sell up to " + max_transactions * lot_size + " shares.";
				            			
				            			if (user.stocks) {
				            				if (user.stocks[company.currentSymbol]) {
				            					text += "\nYou have " + user.stocks[company.currentSymbol] + " shares of " + company.symbol + ".";
				            				}
				            			}
				            			//sendTextMessage(senderID, text);
				            			var textInfo = text + "\n\nAt what price would you like to sell stocks of " 
			            				+ company.symbol + "?";
			            				var quickReplies = [
				                    {
				                      content_type:"text",
				                      title: "" + company.currentPrice,
				                      payload: JSON.stringify({
	                              state: "SELLING_STOCKS",
	                              part: 1,
	                              sellingPrice: company.currentPrice,
	                              recipient: {
	                                id: senderID
	                              },
	                              companyId: company._id,
	                              companyName: company.name,
	                              companySymbol: company.symbol
	                            })
				                    },
				                    {
				                      "content_type":"text",
				                      "title": "" + removeExtraDecimals(company.currentPrice + tick_size, tick_size),
				                      payload: JSON.stringify({
	                              state: "SELLING_STOCKS",
	                              part: 1,
	                              sellingPrice: removeExtraDecimals(company.currentPrice + tick_size, tick_size),
	                              recipient: {
	                                id: senderID
	                              },
	                              companyId: company._id,
	                              companyName: company.name,
	                              companySymbol: company.symbol
	                            })
				                    },
				                    {
				                      "content_type":"text",
				                      "title": "" + removeExtraDecimals(company.currentPrice + tick_size * 2, tick_size),
				                      payload: JSON.stringify({
	                              state: "SELLING_STOCKS",
	                              part: 1,
	                              sellingPrice: removeExtraDecimals(company.currentPrice + tick_size * 2, tick_size),
	                              recipient: {
	                                id: senderID
	                              },
	                              companyId: company._id,
	                              companyName: company.name,
	                              companySymbol: company.symbol
	                            })
				                    }
				                  ];
				                  sendQuickReply(senderID, textInfo, quickReplies);
				            			break;
				            		case 1:
				            			var textInfo = "How many shares would you like to sell?";
			            				var quickReplies = [
				                    {
				                      content_type:"text",
				                      title: "" + max_transactions * lot_size,
				                      payload: JSON.stringify({
	                              state: "SELLING_STOCKS",
	                              part: 2,
	                              sellingPrice: payload.sellingPrice,
	                              sharesAmount: max_transactions * lot_size,
	                              recipient: {
	                                id: senderID
	                              },
	                              companyId: company._id,
	                              companyName: company.name,
	                              companySymbol: company.symbol
	                            })
				                    },
				                    {
				                      "content_type":"text",
				                      "title": "" + (Math.floor(max_transactions/2)) * lot_size,
				                      payload: JSON.stringify({
	                              state: "SELLING_STOCKS",
	                              part: 2,
	                              sellingPrice: payload.sellingPrice,
	                              sharesAmount: (Math.floor(max_transactions/2)) * lot_size,
	                              recipient: {
	                                id: senderID
	                              },
	                              companyId: company._id,
	                              companyName: company.name,
	                              companySymbol: company.symbol
	                            })
				                    },
				                    {
				                      "content_type":"text",
				                      "title": "" + (Math.floor(max_transactions/3)) * lot_size,
				                      payload: JSON.stringify({
	                              state: "SELLING_STOCKS",
	                              part: 2,
	                              sellingPrice: payload.sellingPrice,
	                              sharesAmount: (Math.floor(max_transactions/3)) * lot_size,
	                              recipient: {
	                                id: senderID
	                              },
	                              companyId: company._id,
	                              companyName: company.name,
	                              companySymbol: company.symbol
	                            })
				                    },
				                    {
				                      "content_type":"text",
				                      "title": "" + (Math.floor(max_transactions/4)) * lot_size,
				                      payload: JSON.stringify({
	                              state: "SELLING_STOCKS",
	                              part: 2,
	                              sellingPrice: payload.sellingPrice,
	                              sharesAmount: (Math.floor(max_transactions/4)) * lot_size,
	                              recipient: {
	                                id: senderID
	                              },
	                              companyId: company._id,
	                              companyName: company.name,
	                              companySymbol: company.symbol
	                            })
				                    }
				                  ];
				                  sendQuickReply(senderID, textInfo, quickReplies);
				            			break;
				            		case 2:
				            			const fees = getFees(payload.state, payload.sellingPrice, payload.sharesAmount);
				            			const total = roundup(((payload.sellingPrice * payload.sharesAmount) + fees) * 100, 2)/100;
				            			var textInfo = "Selling stocks of " + company.symbol
				            				+ "\nPrice: " + payload.sellingPrice
				            				+ "\nShares: " + payload.sharesAmount
				            				+ "\nFees: " + fees
				            				+ "\nTotal: " + total;
			            				var quickReplies = [
				                    {
				                      content_type:"text",
				                      title: "Confirm",
				                      payload: JSON.stringify({
	                              state: "SELLING_STOCKS",
	                              part: 3,
	                              sellingPrice: payload.sellingPrice,
	                              sharesAmount: payload.sharesAmount,
	                              fees: fees,
	                              total: total,
	                              recipient: {
	                                id: senderID
	                              },
	                              companyId: company._id,
	                              companyName: company.name,
	                              companySymbol: company.symbol
	                            })
				                    },
				                    {
				                      "content_type":"text",
				                      "title": "Cancel",
				                      payload: JSON.stringify({
	                              state: "IDLE",
	                              part: 0
	                            })
				                    }
				                  ];
				                  sendQuickReply(senderID, textInfo, quickReplies);
				            			break;
				            		case 3:
				            			var text = "Please wait while I process your transaction."
				            			sendTextMessage(senderID, text, function(err, result) {
				            				var query = {}
				            				query["stocks." + payload.companySymbol] = payload.sharesAmount * -1;
				            				query["credit"] = payload.total;

				            				db.userAccounts.update({"fbUserId": senderID}, 
				            					{
				            						"$inc": query
				            					}, function(err, result) {
				            						if (err)
				            							throw err;
				            						if (result.result.nModified > 0) {
				            							db.userAccounts.findOne({"fbUserId": senderID}, function(err, user) {
				            								if (err)
				            									throw err;
				            								if (user) {
				            									text = "Success! you sold " + payload.sharesAmount 
				            										+ " shares of " + company.symbol
				            										+ "\nYou now have PHP " + user.credit;
				            									sendTextMessage(senderID, text, function(err, result) {
				            										if (err)
				            											throw err;
				            										db.users.update({"fbUserId": senderID}, 
				            											{
				            												"$set": {
				            													"payload": JSON.stringify({
				            														state: "IDLE",
				            														part: 0
				            													})
				            												}
				            											});
				            									});
				            								}
				            							});
				            						}
				            					});
				            			});
				            			break;
				            	}
            				} else {
            					var text = "You currently don't have any shares of " + company.symbol;
            					sendTextMessage(senderID, text);
            				}
	            		});
            		}
            	});
              break;
            default:
            	console.log("User is now idle");
          }
        } else {
        	console.log("user does not exist");
        }
      });
    }
	}
}