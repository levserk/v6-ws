# Step game server

## SocketServer

### example

```js
var Server = require('../index.js').SocketServer;

wss = new Server({port: 8080, path:'/ws', pingTimeout:10000, pingInterval:5000});
wss.init();
wss.on('connection', handler)

function handler(ws) {}
```
