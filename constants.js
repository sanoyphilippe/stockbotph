const config = require('config');

module.exports = function() {
  // App Secret can be retrieved from the App Dashboard
  this.APP_SECRET = (process.env.MESSENGER_APP_SECRET) ?
    process.env.MESSENGER_APP_SECRET :
    config.get('appSecret');

  // Arbitrary value used to validate a webhook
  this.VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
    (process.env.MESSENGER_VALIDATION_TOKEN) :
    config.get('validationToken');

  // Generate a page access token for your page from the App Dashboard
  this.PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
    (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
    config.get('pageAccessToken');

  // URL where the app is running (include protocol). Used to point to scripts and
  // assets located at this address.
  this.SERVER_URL = (process.env.SERVER_URL) ?
    (process.env.SERVER_URL) :
    config.get('serverURL');

  this.MONGO_URI = (process.env.MONGO_URI) ?
    (process.env.MONGO_URI) :
    config.get('mongoURI');

  if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL && MONGO_URI)) {
    console.error("Missing config values");
    process.exit(1);
  }
}
