var util = require("util"),
    Promise = require('es6-promise').Promise,
    Server = require('../index').SocketServer,
    WebSocket = require('ws'),
    Test = require("./lib/test_class.js");

/* require specs here */

var MainTest = require('./specs/main.js').start(util, Promise, Server, WebSocket, Test);