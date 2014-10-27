var util = require("util"),
    WebSocketServer = require('ws').Server,
    Emitter = require('events').EventEmitter,
    Socket = require('./socket.js'),
    fs = require("fs");


function SocketServer(opts){
    opts = opts || {};

    global.logLevel = opts.logLevel||global.logLevel||1;

    this.path = opts.path || '/ws';
    this.port = opts.port || 8080;
    this.server = opts.server || false;
    this.https = opts.https || false;
    this.httpsCert = opts.cert || false;
    this.httpsKey = opts.key || false;
    this.pingTimeout = opts.pingTimeout || 60000;
    this.pingInterval = opts.pingInterval || 25000;
    this.timeoutInterval = null;

    this.sockets = [];
    this.rooms = {};
}

module.exports = SocketServer;

// inherit from event emitter;
SocketServer.prototype.__proto__ = Emitter.prototype;


SocketServer.prototype.init = function(){
    this.wss = new WebSocketServer({server: this.createWebServer()});
    this.wss.on('connection', this.onWebSocketConnected.bind(this));
    this.wss.on('error', this.onError.bind(this));
    this.timeoutInterval = setInterval(this.checkTimeout.bind(this),1000);
};


SocketServer.prototype.onWebSocketConnected = function(webSocket){
    if (global.logLevel > 1) util.log('log;','new socket, id:', webSocket.upgradeReq.headers['sec-websocket-key']);
    var socket = new Socket(webSocket, this), self = this;
    this.sockets.push(socket);
    socket.on('disconnect', function(reason){
        if (global.logLevel > 1) util.log('log;', 'socket disconnected', reason);
        this.leaveAll();
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
    if (global.logLevel > 2) util.log('log;', 'socket leave room', socket.id);
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
    var socket, time = (new Date()).valueOf();
    for (var i=0; i<this.sockets.length; i++){
        socket = this.sockets[i];
        if (socket.reseiveTime && socket.sendTime && time-socket.reseiveTime > this.pingTimeout){ // timeout
            socket.close('timeout');
            if (global.logLevel > 1) util.log('log;','socket closed:', socket.id, time-socket.reseiveTime);
            return;
        }
        if (!socket.sendTime || time-socket.sendTime > this.pingInterval){
            socket.ping();
        }
    }
};


SocketServer.prototype.createWebServer = function(){
    if (this.server){
        if (!this.server.listen) throw new Error("Server in options must be http or https server");
        return this.server;
    }
    if (!this.https) this.server = require("http").createServer(response);
    else {
        if (!this.httpsKey || !this.httpsCert) throw new Error("Check https key and certificate in options");
        this.server = require("https").createServer({
            key:fs.readFileSync(this.httpsKey),
            cert:fs.readFileSync(this.httpsCert)
        },response);
    }
    this.server.listen(this.port);
    return this.server;

    function response(req, res){
        res.writeHead(200);
        res.end("welcome");
    }
};