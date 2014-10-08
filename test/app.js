var util = require("util");
var Server = require('../index.js').SocketServer, wss;
init();

function init(){
    util.log('server started');
    wss = new Server({port: 8080, path:'/ws', pingTimeout:10000, pingInterval:5000});
    wss.init();
    wss.on('connection', webSocketConnected)
}

function webSocketConnected(ws){
    util.log(ws);
    bindWebSocketEvents(ws);
}

function bindWebSocketEvents(ws){
    ws.on('close', function(code, message){
        util.log('ws closed', code, message)
    });
    ws.on('error', function(error){
        util.log('ws error', error)
    });
    ws.on('message', function(data, flags){
        util.log('ws message', data, flags)
    });
    ws.on('open', function(){
        util.log('ws open')
    });
}