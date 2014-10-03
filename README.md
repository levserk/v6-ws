# Step game server

## SocketServer

### example

```js
var server = new require('socket-server').SocketServer({port: 8000});
server.on('connection', function(socket){
  console.log('new socket connected, id: ',socket.id);
  socket.send({message:"welcome to socket-server!"});
})
```


