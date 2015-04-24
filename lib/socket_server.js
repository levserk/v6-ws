var util = require("util"),
    WebSocketServer = require('ws').Server,
    EventEmitter = require('events').EventEmitter,
    Socket = require('./socket.js'),
    fs = require("fs");

module.exports = function (opts) {
    opts = opts || {};
    global.logLevel = opts.logLevel||global.logLevel||1;
    opts.path = opts.path || '/ws';
    opts.port = opts.port || 8080;
    opts.server = opts.server || false;
    opts.https = opts.https || false;
    opts.httpsCert = opts.cert || opts.httpsCert || false;
    opts.httpsKey = opts.key || opts.httpsKey || false;
    opts.httpsCa = opts.httpsCa || false;
    opts.nativePing = opts.nativePing || false;
    opts.pingTimeout = opts.pingTimeout || 60000;
    opts.pingInterval = opts.pingInterval || 25000;
    return new SocketServer(opts);
};


function SocketServer(opts){
    EventEmitter.call(this);
    this.opts = opts;
    this.path = opts.path;
    this.port = opts.port;
    this.server = opts.server;
    this.pingInterval = opts.pingInterval;
    this.isRun = false;
    this.timeoutInterval = null;
    this.sockets = [];
    this.rooms = {};
}

util.inherits(SocketServer, EventEmitter);

SocketServer.prototype.name = '__SocketServer__';


SocketServer.prototype.init = function(callback){
    var server = this.createWebServer(function (error) {
        if (!error) {
            this.wss = new WebSocketServer({
                server: server,
                clientTracking: false
            });
            this.wss.on('connection', this.onWebSocketConnected.bind(this));
            this.wss.on('error', this.onError.bind(this));
            this.timeoutInterval = setInterval(this.checkTimeout.bind(this), 1000);
        } else this.onError(error);

        if (typeof callback == "function") callback(error);
    }.bind(this));
};


SocketServer.prototype.onWebSocketConnected = function(webSocket){
    if (global.logLevel > 1) util.log('log;','new socket, id:', webSocket.upgradeReq.headers['sec-websocket-key']);
    var socket = new Socket(webSocket, this), self = this;
    this.sockets.push(socket);
    socket.on('disconnect', function(reason){
        if (global.logLevel > 1) util.log('log;', 'socket disconnected', reason);
        var index = self.sockets.indexOf(this);
        if (index != -1) {
            self.sockets.splice(index, 1);
        }
    });
    this.emit('connection', socket);
};


SocketServer.prototype.broadcast = function(data, socket){
    var sockets = this.sockets;
    if (this instanceof Array) sockets = this;
    for (var i=0; i<sockets.length; i++){
        if (sockets[i] != socket) sockets[i].send(data);
    }
};


SocketServer.prototype.in = function(room){
    var self = this;
    if (!self.rooms[room]) throw new Error('Wrong room, '+room);
    return {
        broadcast:self.broadcast.bind(self.rooms[room])
    }
};


SocketServer.prototype.to = function(id){
    if (!this.rooms[id] || this.rooms[id].length != 1) throw new Error('Wrong socket id, '+id);
    return this.rooms[id][0];
};


SocketServer.prototype.enterRoom = function(room, socket){
    if (!room) throw new Error('Wrong room, '+room);
    if (!socket) throw new Error('Wrong socket');
    if (!this.rooms.hasOwnProperty(room)) this.rooms[room] = [];
    this.rooms[room].push(socket);
    return this.rooms[room];
};


SocketServer.prototype.leaveRoom = function(room, socket){
    if (!room || !this.rooms[room]) {
        if (global.logLevel > 1) util.log('warning; leave wrong room', room);
        return;
    }
    if (!socket) throw new Error('Wrong socket');
    if (global.logLevel > 2) util.log('log;', 'socket ', socket.id, ' leave room ', room);
    var index = this.rooms[room].indexOf(socket);
    if (index != -1) {
        this.rooms[room].splice(index, 1);
    }
    if (this.rooms[room].length == 0) delete this.rooms[room];
};


SocketServer.prototype.onError = function(error){
    util.log('error;', 'WebSocketServer', error);
};


SocketServer.prototype.checkTimeout = function(){
    var socket, time = Date.now();
    for (var i=0; i<this.sockets.length; i++){
        socket = this.sockets[i];
        if (socket.reseiveTime && socket.sendTime && time-socket.reseiveTime > this.opts.pingTimeout){ // timeout
            socket.close('timeout');
            if (global.logLevel > 1) util.log('log;','socket closed:', socket.id, 'ms timeout:', time-socket.reseiveTime);
            return;
        }
        if (!socket.sendTime || time-socket.sendTime > this.pingInterval){
            socket.ping();
        }
    }
};


SocketServer.prototype.createWebServer = function(callback){
    var self =this;
    if (this.server){
        if (!this.server.listen) throw new Error("Server in options must be http or https server");
    }

    if (!this.opts.https) this.server = require("http").createServer(response);
    else {
        if (!this.opts.httpsKey || !this.opts.httpsCert) throw new Error("Check https key and certificate in options");
        var httpsObj = {
            key:fs.readFileSync(this.opts.httpsKey),
            cert:fs.readFileSync(this.opts.httpsCert)
        };
        if (this.opts.httpsCa && this.opts.httpsCa.length> 0){
            httpsObj.ca = [];
            for (var i = 0; i < this.opts.httpsCa.length; i++){
                httpsObj.ca.push(fs.readFileSync(this.opts.httpsCa[i]))
            }
        }
        this.server = require("https").createServer(httpsObj,response);
    }

    this.server.listen(this.port);

    this.server.on('listening', function(){
        self.isRun = true;
        callback(false);
    });

    this.server.on('error', function(error){
        util.log('error; http error', arguments);
        if (!self.isRun) callback(error)
    });

    return this.server;

    function response(req, res){
        res.writeHead(200);
        res.end("welcome");
    }
};