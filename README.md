# WebSocket server

Simple WebSocket server with rooms, clients timeout and namespace.

Server side: SocketServer
Client side: default websocket

## Example

```js
var Server = require('v6-ws').SocketServer;

wss = new Server({port: 8080, path:'/ws', pingTimeout:10000, pingInterval:5000});
wss.init(function(error){});
wss.on('connection', handler)

function handler(ws) {}
```

## API

### SocketServer(opts:Object)

__Options__:

- `path` namespace websocket server for connection, default is '\ws'
- `port` listening port, optional, default is 8080
- `server`  optional web server
- `https` optional https flag, default is false
- `cert` path to ssl certificate for https, optional
- `key`  path to ssl key for https, optional
- `pingTimeout` default is 60000 ms
- `pingInterval`  default is 25000 ms

__Events__:

- `connection` function(socket:#Socket) emit client connected

### Socket(opts:Object)

__Properties__:

- `id` websoket id
- `cookies` #Object, key value array

__Functions__:

- `send` function (data: #Object) sends data to socket client
- `in` function (room: #String) return two functions to send data in room to other sockets: __send__ and __broadcast__
- `enterRoom` function (room: #String)
- `leaveRoom` function (room: #String)
- `leaveAll` function () leave all rooms
- `close` function (reason #String) disconnect socket

__Events__:

- `message` function (data) incoming message to socket
- `disconnect` function (reason)


```js
wss.on('connection', function(socket){
    socket.enterRoom('test room');
    socket.in('test room').send('Hi all!');
    socket.leaveRoom('test room');
});
```