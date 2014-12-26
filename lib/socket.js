var util = require("util"),
    EventEmitter = require('events').EventEmitter;

module.exports = function(webSocket, server){
    return new Socket(webSocket, server)
};

var Socket = function(webSocket, server){
    EventEmitter.call(this);
    this.ws = webSocket;
    this.server = server;
    this.nativePing = server.opts.nativePing;
    this.rooms = {};
    this.readCookies();
    this.bindEvents();
    this.enterRoom(this.id);
};

util.inherits(Socket, EventEmitter);

Socket.prototype.name = '__Socket__';


Socket.prototype.send = function(data){
    if (!data) return;
    try{
        if (typeof data != "string") data = JSON.stringify(data);
        this.ws.send(data);
        if (global.logLevel > 3) util.log('log;','ws send message', data, this.id);
    } catch (e){
        util.log('error', 'Socket.sendMessage', e, data);
    }
};


Socket.prototype.bindEvents = function(){
    var self = this;
    self.ws.on('pong',self.onPong.bind(self));
    self.ws.on('message',self.onMessage.bind(self));
    self.ws.on('close',function(code){
        if (global.logLevel > 1) util.log('log;','ws close', code);
        self.emit('disconnect', self.closeReason||'close_code: ' + code);
        self.clean();
    });
    self.ws.on('error', function(error){
        util.log('error;','ws', error)
    });
};


Socket.prototype.ping = function(){
    this.sendTime = Date.now();
    try {
        if (this.nativePing) this.ws.ping(1);
        else this.ws.send('ping');
    } catch (e){
        util.log('error;', 'Socket.ping send error', e, this.id);
    }
    if (global.logLevel > 3) util.log('log;','send ping, socket.id: ',this.id, this.sendTime - this.reseiveTime, this.reseiveTime);
};


Socket.prototype.onPong = function (){
    if (global.logLevel > 4) util.log('log;','pong, socket.id: ', this.id, this.sendTime - this.reseiveTime, this.reseiveTime);
    this.reseiveTime = Date.now();
};


Socket.prototype.onMessage = function(data){
    if (!data || typeof data != "string") return;
    try{
        if (data=='pong'){
            this.onPong();
            return;
        }
        if (global.logLevel > 2) util.log('log;', 'Socket.onMessage', data);
        data = JSON.parse(data);
    } catch (e){
        util.log('error;', 'Socket.onMessage parse error', e, data);
        return;
    }
    if (global.logLevel > 3) util.log('log;','ws received message', data);
    this.emit('message', data);
};


Socket.prototype.close = function(reason){
    reason = reason || 'force';
    this.closeReason = reason;
    this.ws.close();
};


Socket.prototype.readCookies = function(){
    this.cookie = {};
    this.id = null;
    try{
        this.id =  this.ws.upgradeReq.headers['sec-websocket-key'];
        if (typeof this.ws.upgradeReq.headers.cookie != "undefined"){
            var sCookie =  this.ws.upgradeReq.headers.cookie.split('; '), cookie;
            for (var i=0; i<sCookie.length; i++){
                cookie = sCookie[i].split('=');
                if (cookie.length == 2) this.cookie[cookie[0]] = cookie[1];
            }
        }
        if (global.logLevel > 2) util.log('log;', this.id, this.cookie);
    } catch (e){
        util.log('error;', 'Socket.readCookies', e);
    }
};

/**
 *
 * @param room - room name
 * @returns {{send: Function, sends message in room,
 *       broadcast: (*|Function|SocketServer.in.broadcast), broadcast message}}
 */
Socket.prototype.in = function(room){
    var self = this;
    return {
        send: function(data){
            return self.server.in(room).broadcast(data, self);
        },
        broadcast: self.server.in(room).broadcast
    }
};


Socket.prototype.enterRoom = function(room){
    if (!room) return;
    this.rooms[room] = this.server.enterRoom(room, this);
    if (global.logLevel > 1) util.log('log;', 'enter room, ', room, this.id);
};


Socket.prototype.leaveRoom = function(room){
    if (!room) return;
    this.server.leaveRoom(room, this);
    delete this.rooms[room];
};


Socket.prototype.leaveAll = function(){
    for (var room in this.rooms){
        this.server.leaveRoom(room, this);
    }
    delete this.rooms;
};


Socket.prototype.clean = function(){
    this.removeAllListeners();
    delete this.ws;
};