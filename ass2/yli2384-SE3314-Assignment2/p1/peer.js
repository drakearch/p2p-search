//Collabrated with some classmates for this assignment with ouda's permission


//initialization
let net = require('net'),
    singleton = require('./Singleton'),
    handler = require('./ClientsHandler');
let HOST = '127.0.0.1',
    PORT = Math.round(Math.random() * (9999 - 1000) + 1000);

//this determine whether they are connected and the number of peers we have in the system
var connecting = false;
var numP = 0;

// this part spilts the input array
process.argv.forEach(function (val, index, array) {    
    if(index == 3)
    {
        connecting = true;
        HOST = val.split(":")[0];
        PORT = val.split(":")[1];
    }
});

net.bytesWritten = 300000;
net.bufferSize = 300000;


singleton.init();

if(connecting) // if peer is connecting to another
{
    // get folder name
    var str = __dirname;
    //var ret = str.split("\\").reduce((p,c,i,arr) => {if(i >= arr.length - 1){return (p?("\\"+p+"\\"):"")+c}}); 
    var ret = str.split("/").reduce((p,c,i,arr) => {if(i >= arr.length - 1){return (p?("/"+p+"/"):"")+c}});  

    var peerClient = new net.Socket(); // create socket
    peerClient.connect(PORT, HOST, function() { // connect socket to server, and on connecting to server,
    
    // get host and port
    HOST = '127.0.0.1';
    PORT = Math.round(Math.random() * (9999 - 1000) + 1000);

    // send the peer peer port and folder name
    peerClient.write(PORT.toString() + ":" + ret.toString());

    // on receiving a message packet,
    peerClient.on('data', function(resdata) {
        handler.setPeerTable(resdata.toString().split(":")[resdata.toString().split(":").length-1]); // set our own peer table with data that proved to be necessary for this program's functionality
        if(resdata.toString().includes('-')) // if we are P2P and peer table is not empty,
        {
            if(parseInt(resdata.toString().split("-")[1].slice(0,3),16).toString() == "3314") // if the version number is 3314
            {
                if(resdata.toString().length <= 57) // if the packet + other data's length is less than 57,
                {
                    console.log('Connected to peer: ' + resdata.toString().split(":")[resdata.toString().split(":").length-1].split(".")[0] + ':' + resdata.toString().split(":")[resdata.toString().split(":").length-1].split(".")[1] + " at timestamp: " + singleton.getTimestamp());
                    console.log("This peer address is " + HOST + ":" + PORT + " located at " + ret);
                    console.log("Recieved ack from " + resdata.toString().split(":")[resdata.toString().split(":").length-1].split(".")[0] + ":" + resdata.toString().split(":")[resdata.toString().split(":").length-1].split(".")[1]);
                    console.log(" which is peered with: " + HOST + ":" + resdata.toString().split("-")[0].split(".")[1]);
                }
            }
            else
            {
                console.log("Error");
            }
        }
        else
        {
            if(parseInt(resdata.toString().slice(0,3),16).toString() == "3314") // if the version number is 3314
            {
                if(resdata.toString().length == 28) // first peer connected,
                {
                    console.log('Connected to peer: ' + resdata.toString().split(":")[1].split(".")[0] + ':' + resdata.toString().split(":")[1].split(".")[1] + " at timestamp: " + singleton.getTimestamp());
                    console.log("This peer address is " + HOST + ":" + PORT + " located at " + ret);
                    console.log("Recieved ack from " + resdata.toString().split(":")[1].split(".")[0] + ":" + resdata.toString().split(":")[1].split(".")[1]);
                }
                else if(resdata.toString().length == 49) // second peer connected, 
                {
                    console.log('Connected to peer: ' + resdata.toString().split(":")[2].split(".")[0] + ':' + resdata.toString().split(":")[2].split(".")[1] + " at timestamp: " + singleton.getTimestamp());
                    console.log("This peer address is " + HOST + ":" + PORT + " located at " + ret);
                    console.log("Recieved ack from " + resdata.toString().split(":")[2].split(".")[0] + ":" + resdata.toString().split(":")[2].split(".")[1]);
                    console.log(" which is peered with: " + HOST + ":" + parseInt(resdata.toString().slice(12,16),10).toString());
                }
                else if(resdata.toString().length >= 70) // third+ peer connected
                {
                    console.log('Connected to peer: ' + resdata.toString().split(":")[resdata.toString().split(":").length - 1].split(".")[0] + ':' + resdata.toString().split(":")[resdata.toString().split(":").length - 1].split(".")[1] + " at timestamp: " + singleton.getTimestamp());
                    console.log("This peer address is " + HOST + ":" + PORT + " located at " + ret);
                    console.log("Recieved ack from " + resdata.toString().split(":")[resdata.toString().split(":").length - 1].split(".")[0] + ":" + resdata.toString().split(":")[resdata.toString().split(":").length - 1].split(".")[1]);
                    console.log(" which is peered with: " + HOST + ":" + parseInt(resdata.toString().slice(12,16),10).toString());
                    console.log("Join redirected, try to connect to the peer above");
                    peerClient.destroy();
                }
            }
            else
            {
                console.log("WRONG VERSION NUMBER");
                peerClient.destroy();
            }
        }
    });
    // create server and listen on port
    let peerServer = net.createServer();
    peerServer.listen(PORT, HOST, 100);

        peerServer.on('connection', function(sock) { // on connection,
            if(numP <= 2) // if peer is not at max peers
            {
                numP++;
                handler.handleClientJoining(sock,HOST,"1",++numP,ret,PORT); // called for each client joining
            }
            else
            {
                handler.handleClientJoining(sock,HOST,"2",++numP,ret,PORT); // called for each client joining
            }
        });
    });
}
else
{
    // create server and listen on the port
    let peerServer = net.createServer();
    peerServer.listen(PORT, HOST,100);

    // get folder name
    var str = __dirname;
    //var ret = str.split("\\").reduce((p,c,i,arr) => {if(i >= arr.length - 1){return (p?("\\"+p+"\\"):"")+c}});
    var ret = str.split("/").reduce((p,c,i,arr) => {if(i >= arr.length - 1){return (p?("/"+p+"/"):"")+c}});

    console.log("This peer address is " + HOST + ":" + PORT + " located at " + ret);

    peerServer.on('connection', function(sock) { // on connection,
        if(numP <= 2) // if peer is not at max peers
        {
            numP++;
            handler.handleClientJoining(sock,HOST,"1",numP,ret,PORT); // called for each client joining
        }
        else
        {
            handler.handleClientJoining(sock,HOST,"2",numP,ret,PORT); // called for each client joining
        }
    });
}