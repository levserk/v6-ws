var util = require("util"),
    WebSocketServer = require('ws').Server,
    Emitter = require('events').EventEmitter,
    Socket = require('./socket.js'),
    fs = require("fs");


function SocketServer(opts){
    opts = opts || {};

    this.path = opts.path || '/ws';
    this.port = opts.port || 8080;
    this.https = opts.https || false;
    this.pingTimeout = opts.pingTimeout || 60000;
    this.pingInterval = opts.pingInterval || 25000;
    global.logLevel = opts.logLevel||global.logLevel||1;

    this.sockets = [];
    this.rooms = {};
    this.wss = new WebSocketServer({server: createWebServer(this)});
    this.bindEvents();

}
module.exports = SocketServer;

// inherit from event emitter;
SocketServer.prototype.__proto__ = Emitter.prototype;


SocketServer.prototype.bindEvents = function(){
    this.wss.on('connection', this.onWebSocketConnected.bind(this));
    this.wss.on('error', this.onError.bind(this));
    clearInterval(this.timeoutInterval);
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


function createWebServer(opts){
    var server;
    if (!opts.https) server = require("http").createServer(response);
    else server = require("https").createServer({
        key:fs.readFileSync("/etc/apache2/ssl/serv.key"),
        cert:fs.readFileSync("/etc/apache2/ssl/serv.crt"),
        ca:[fs.readFileSync("/etc/apache2/ssl/sub.class1.server.ca.pem"),
            fs.readFileSync("/etc/apache2/ssl/ca.pem")]
    },response);
    server.listen(opts.port);
    return server;

    function response(req, res){
        res.writeHead(200);
        res.end("logic-games.spb.ru\n");
    }
}