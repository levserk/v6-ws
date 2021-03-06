var userId = ('id_'+Math.random() * new Date()).substr(10);
var client;
document.ready = function(){
    console.log(new Date(), 'ready');

    client = new Socket({domain:'localhost'});
};


var Socket = function(opts){
    var self = this;

    opts = opts || {};
    var port = opts.port||'8080';
    var domain = opts.domain || 'localhost';
    var url = opts.url || 'ws';
    var timeLastPing, lastServerTume, serverTimeDelta;

    this.ws = new WebSocket ('ws://'+domain+':'+port+'/'+url);
    this.ws.onclose = function (code, message) {
        console.log('ws closed', code, message)
    };
    this.ws.onerror = function (error) {
        console.log('ws error', error)
    };
    this.ws.onmessage = function (data, flags) {
        console.log('ws message', data, flags);
        self.onMessage(data.data);
    };
    this.ws.onping = function (data, flags) {
        console.log('ws ping', data, flags);
    };
    this.ws.onopen = function () {
        console.log(new Date(), 'ws open');
    };
};

Socket.messageTypes = {
    message:1, ping:2, pong:3
};

Socket.prototype.onMessage = function(data) {
    try{
        data = JSON.parse(data)
    } catch (e) {
        util.log('ws wrong data in message', e);
        return;
    }
    if (typeof  data.type != 'number') {
        util.log('ws wrong message type', data.type);
        return;
    }
    this.reseiveTime = (new Date()).valueOf();
    switch (data.type){
        case Socket.messageTypes.message:
            break;
        case Socket.messageTypes.ping:
            this.sendMessage({time:this.reseiveTime},Socket.messageTypes.pong);
            break;
    }
    console.log(this.reseiveTime, data);
};

Socket.prototype.onPing = function(data){

};

Socket.prototype.sendMessage = function(data, type) {
    type = type||Socket.messageTypes.message;
    if (!data || typeof data != "object") return;
    data.type = type;
    data = JSON.stringify(data);
    this.ws.send(data);
    if (type == Socket.messageTypes.pong) this.sendTime = (new Date()).valueOf();
};


Socket.prototype.sendPong = function(){
    this.sendMessage({time:new Date()},Socket.messageTypes.pong);
};
