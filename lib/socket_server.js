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
    opts.stats = false; //opts.stats || false;
    opts.statsInterval = opts.statsInterval || 15000;
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
    this.statsInterval = null;
    this.sockets = [];
    this.rooms = {};
    this.stats = {
        startTime: Date.now(),
        lastTime: 0,
        lastLog: 0,
        connections: 0,
        disconnections: 0,
        timeouts: 0,
        req:{
            hits: { perSec: 0, perMin: 0, count: 0,  total: 0 },
            bytes: { perSec: 0, perMin: 0, count: 0, total: 0 }
        },
        res:{
            hits: { perSec: 0, perMin: 0, count: 0, total: 0 },
            bytes: { perSec: 0, perMin: 0, count: 0, total: 0 }
        }
    }
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
            if (this.opts.stats){
                this.statsInterval = setInterval(this.updateStats.bind(this), 1000);
            }
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
        if (self.opts.stats) self.saveStats(1, 'disconnection');
    });
    if (this.opts.stats) this.saveStats(1, 'connection');
    this.emit('connection', socket);
};


SocketServer.prototype.broadcast = function(data, socket){
    var sockets = this.sockets;
    if (this instanceof Array) sockets = this;

    try{
        if (typeof data != "string") data = JSON.stringify(data);
        for (var i = 0, len = sockets.length; i < len; i++){
            if (sockets[i] != socket) {
                sockets[i].send(data);
            }
        }
    } catch (e){
        if (global.logLevel > 0) util.log('error;', 'SocketServer.broadcast', e, data);
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


SocketServer.prototype.onMessageSend = function(length){
    if (!this.opts.stats) return;
    this.saveStats(length, 'res');
};


SocketServer.prototype.onMessageReceived = function(length){
    if (!this.opts.stats) return;
    this.saveStats(length, 'req');
};


SocketServer.prototype.saveStats = function(length, type){
    try{
        var stats = this.stats;
        switch (type){
            case 'res':
                stats = this.stats.res;
                stats.hits.count++;
                stats.hits.total++;
                stats.bytes.count += length*2;
                stats.bytes.total += length*2;
                break;
            case 'req':
                stats = this.stats.req;
                stats.hits.count++;
                stats.hits.total++;
                stats.bytes.count += length*2;
                stats.bytes.total += length*2;
                break;
            case 'connection':
                stats.connections++;
                break;
            case 'disconnection':
                stats.disconnections++;
                break;
            case 'timeout':
                stats.timeouts++;
                break;
        }

    } catch (e){
        if (global.logLevel > 1) util.log('error;', 'SocketServer.saveStats error', e);
    }
};


SocketServer.prototype.printStats = function(){
    if (global.logLevel < 1) return;
    var req = this.stats.req, res = this.stats.res;
    util.log('stats; =======');
    util.log('stats; time work: ', SocketServer.getTime(Date.now() - this.stats.startTime), 'sockets:', this.sockets.length,
        'con:',this.stats.connections, 'dis:',this.stats.disconnections, 'timeouts:',this.stats.timeouts);
    util.log('stats;', res.hits.perSec + req.hits.perSec, 'hits p/s; ', (res.bytes.perSec + req.bytes.perSec)*8, 'bits p/s');
    util.log('stats; req hits (s/m/t): ', req.hits.perSec, req.hits.perMin, req.hits.total);
    util.log('stats; res hits (s/m/t): ', res.hits.perSec, res.hits.perMin, res.hits.total);
    util.log('stats; tot hits (s/m/t): ', res.hits.perSec + req.hits.perSec, res.hits.perMin + req.hits.perMin,
        res.hits.total + req.hits.total);
    util.log('stats; req bytes (s/m/t): ', req.bytes.perSec, req.bytes.perMin, req.bytes.total);
    util.log('stats; res bytes (s/m/t): ', res.bytes.perSec, res.bytes.perMin, res.bytes.total);
    util.log('stats; tot bytes (s/m/t): ', res.bytes.perSec + req.bytes.perSec, res.bytes.perMin + req.bytes.perMin,
        res.bytes.total + req.bytes.total);
    util.log('stats; =======');
};


SocketServer.getTime = function(time){
    time = (time / 1000) ^ 0;
    var h = (time / 3600) ^ 0;
    time = time -  h * 3600;
    var m = (time / 60) ^ 0;
    time = time - m * 60;
    var s = time  ^ 0;
    h = (h < 10?'0':'') + h;
    m = (m < 10?'0':'') + m;
    s = (s < 10?'0':'') + s;
    return h+':'+m+':'+s;
};


SocketServer.prototype.updateStats = function(){
    var now = Date.now(), stats = this.stats, interval = 5*1000*60;

    stats.req.hits.perSec = (stats.req.hits.count / (now - stats.lastTime) * 1000) ^0;
    stats.req.bytes.perSec = (stats.req.bytes.count / (now - stats.lastTime) * 1000) ^0;
    stats.res.hits.perSec = (stats.res.hits.count / (now - stats.lastTime) * 1000) ^0;
    stats.res.bytes.perSec = (stats.res.bytes.count / (now - stats.lastTime) * 1000) ^0;

    stats.req.hits.perMin = (stats.req.hits.count / (now - stats.lastTime) * 60000) ^0;
    stats.req.bytes.perMin = (stats.req.bytes.count / (now - stats.lastTime) * 60000) ^0;
    stats.res.hits.perMin = (stats.res.hits.count / (now - stats.lastTime) * 60000) ^0;
    stats.res.bytes.perMin = (stats.res.bytes.count / (now - stats.lastTime) * 60000) ^0;

    if (now - stats.lastLog >= this.opts.statsInterval){
        stats.lastLog = now;
        this.printStats();
    }

    if (now - stats.lastTime >= interval){
        stats.lastTime = now;
        stats.req.hits.count = 0;
        stats.req.bytes.count = 0;
        stats.res.hits.count = 0;
        stats.res.bytes.count = 0;
    }

};


SocketServer.prototype.checkTimeout = function(){
    var socket, time = Date.now();
    for (var i=0; i<this.sockets.length; i++){
        socket = this.sockets[i];
        if (socket.reseiveTime && socket.sendTime && time-socket.reseiveTime > this.opts.pingTimeout){ // timeout
            socket.close('timeout');
            if (global.logLevel > 1) util.log('log;','socket closed:', socket.id, 'ms timeout:', time-socket.reseiveTime);
            if (this.opts.stats) this.saveStats(1, 'timeout');
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