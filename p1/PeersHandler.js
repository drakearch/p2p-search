let net = require('net'),
    cPTPpacket = require('./cPTPmessage'),
    ITPpacket = require('./ITPpacketResponse'),
    singleton = require('./Singleton');
const fs = require('fs');

let peerTable = {},
    peerList = {},
    firstPeerIP = {},
    firstPeerPort = {},
    isFull = {},
    nickNames = {},
    clientIP = {},
    startTimestamp = {};


module.exports = {
    handlePeerJoining: handlePeerJoining,
    handleConnect: handleConnect,
    handleSearch: handleSearch,

    handleImageJoining: handleImageJoining
};


function handleImageJoining (sock, peerTable, searchHistory, maxPeers, sender, imagePackets) {
    assignClientName(sock, nickNames);
    const chunks = [];
    console.log('\n' + nickNames[sock.id] + ' is connected at timestamp: ' + startTimestamp[sock.id]);
    sock.on('data', function (requestPacket) {
        handleClientRequests(requestPacket, sock, peerTable, searchHistory, maxPeers, sender, imagePackets); //read client requests and respond

    });
    sock.on('close', function () {
        handleClientLeaving(sock);
    });
}

function handleClientRequests(data, sock, peerTable, searchHistory, maxPeers, sender, imagePackets) {
    let version = bytes2number(data.slice(0, 3));
    let requestType = bytes2number(data.slice(3, 4));

    if (requestType == 0) {
        let imageFilename = bytes2string(data.slice(4));
        console.log('\n' + nickNames[sock.id] + ' requests:'
            + '\n    --ITP version: ' + version
            + '\n    --Request type: ' + requestType
            + '\n    --Image file name: \'' + imageFilename +'\'\n');

        fs.readFile('images/' + imageFilename, (err, data) => {
            if (!err) {
                var infile = fs.createReadStream('images/' + imageFilename);
                const imageChunks = [];
                infile.on('data', function (chunk) {
                    imageChunks.push(chunk);
                });

                infile.on('close', function () {
                    let image = Buffer.concat(imageChunks);
                    ITPpacket.init(1, singleton.getSequenceNumber(), singleton.getTimestamp(), image, image.length);
                    sock.write(ITPpacket.getPacket());
                    sock.end();
                });
            } else {
                // Clear Received images...
                imagePackets.length = 0;
                console.log('readfile error');
                let originAddress = {'origin': {'port': sock.localPort, 'IP': sock.localAddress}};
                handleSearch (peerTable, searchHistory, maxPeers, sender, originAddress, sock.remotePort, imageFilename);
                // find if package arrived to server
                let timeTick = 0;
                let timer = setInterval(function () {
                    if (imagePackets.length > 0) {
                        console.log('Package found....!!!!!!');
                        sock.write(imagePackets[0]);
                        sock.end();
                        clearInterval(timer);
                    } 
                    // Timeout
                    if (timeTick === 100) {
                        console.log('send image not found!');
                        sock.end();
                        clearInterval(timer);
                    }
                    timeTick++;
                }, 5);
            }
        });
    }

    // Another peer send image packet
    if (requestType == 1) {
        imagePackets.push(data);
        console.log('Image received in', requestType);
    }
}

function handleClientLeaving(sock) {
    console.log(nickNames[sock.id] + ' closed the connection');
}

function assignClientName(sock, nickNames) {
    sock.id = sock.remoteAddress + ':' + sock.remotePort;
    startTimestamp[sock.id] = singleton.getTimestamp();
    var name = 'Client-' + startTimestamp[sock.id];
    nickNames[sock.id] = name;
    clientIP[sock.id] = sock.remoteAddress;
}


function handleSearch (peerTable, searchHistory, maxPeers, sender, originPeerImageSocket, searchID, filename) {
    let searchKey = searchID + ':' + filename;
    // Update search history
    if(searchHistory.length >= maxPeers)
        searchHistory.shift();
    searchHistory.push(searchKey);
    // Send search packet to peers
    cPTPpacket.init(3, sender, originPeerImageSocket, searchID, filename);
    let searchPacket = cPTPpacket.getPacket();
    sendSearchPacket(peerTable, searchPacket); 
}

function sendSearchPacket (peerTable, searchPacket) {
    Object.values(peerTable).forEach(peer => {
        let searchSock = new net.Socket();
        searchSock.connect(peer.port, peer.IP, function () {
            searchSock.write(searchPacket);
            searchSock.end();
        });
        searchSock.on('error', function () {
            console.log(peer.IP + ':' + peer.port, 'not available!');
            searchSock.end();
        });
    }); 
}

function handlePeerJoining (sock, maxPeers, sender, peerTable, unpeerTable, searchHistory) {
    sock.on('data', (message) => {
        // Data is <n ip_address:port
        var pattern = /^\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}:\d+$/;
        if (bytes2string(message).match( pattern )) { // If new peer2peer connection
            let addr = bytes2string(message).split(':');
            let peer = {'port': addr[1], 'IP': addr[0]};
            let peersCount = Object.keys(peerTable).length;
            if (peersCount === maxPeers) 
                declineClient(sock, sender, peerTable, unpeerTable);
            else 
                handleClient(sock, sender, peer, peerTable, unpeerTable)
        } else { // Peer2Peer Search
            let msgType = bytes2number(message.slice(3, 4));
            if (msgType == 3) {
                let sender = bytes2string(message.slice(4, 8));
                let searchID = bytes2number(message.slice(8, 12));
                let originPort = bytes2number(message.slice(14, 16));
                let originIP = bytes2number(message.slice(16, 17)) + '.'
                    + bytes2number(message.slice(17, 18)) + '.'
                    + bytes2number(message.slice(18, 19)) + '.'
                    + bytes2number(message.slice(19, 20));
                let imageFilename = bytes2string(message.slice(20));
                console.log(msgType, sender, searchID, originIP+':'+originPort, imageFilename);
                
                let searchKey = searchID + ':' + imageFilename;
                console.log(searchKey);
                // If P2Psearch not in recent search history... else discard packet
                if (searchHistory.indexOf(searchKey) < 0) {
                    // Update search history
                    if(searchHistory.length >= maxPeers)
                        searchHistory.shift();
                    searchHistory.push(searchKey);

                    fs.readFile('images/' + imageFilename, (err, data) => {
                        if (!err) { // If image exist locally.
                            console.log(imageFilename, 'exists! Sending image...');
                            let originAddress = {'port': originPort, 'IP': originIP};
                            sendImagePacket('images/' + imageFilename, originAddress);
                        } else {
                            console.log(imageFilename, 'nooooo exists! Searching in pairs...');
                            sendSearchPacket(peerTable, message);
                        }
                    });
                }
            }
        }
    });
}

function sendImagePacket (filePath, peer) {
    let imageSock = new net.Socket();
    imageSock.connect(peer.port, peer.IP, function () {
        let infile = fs.createReadStream(filePath);
        const imageChunks = [];
        infile.on('data', function (chunk) {
            imageChunks.push(chunk);
        });
        infile.on('close', function () {
            let image = Buffer.concat(imageChunks);
            ITPpacket.init(1, singleton.getSequenceNumber(), singleton.getTimestamp(), image, image.length);
            imageSock.write(ITPpacket.getPacket());
            imageSock.end();
        });
    });
}

function handleConnect (knownPeer, localPeer, maxPeers, peerLocation, peerTable, unpeerTable) {
        
    // add the server (the receiver request) into the table as pending
    let pendingPeer = {'port': knownPeer.port, 'IP': knownPeer.IP, 'pending': true};
    let peerAddress = pendingPeer.IP + ':' + pendingPeer.port;
    peerTable[peerAddress] = pendingPeer;
    // connect to the known peer address
    let clientPeer = new net.Socket();
    clientPeer.connect(knownPeer.port, knownPeer.IP, function () {
        handleCommunication(clientPeer, maxPeers, peerLocation, peerTable, unpeerTable);
        clientPeer.write(localPeer.IP + ':' + localPeer.port);
    });
    clientPeer.on('error', function () {
        unpeerTable[peerAddress] = {'port': knownPeer.port, 'IP': knownPeer.IP, 'status': 'error'};
        delete peerTable[peerAddress];
    });
}

function handleCommunication (client, maxPeers, location, peerTable, unpeerTable) {
    // get message from server

    client.on('data', (message) => {
        let version = bytes2number(message.slice(0, 3));
        let msgType = bytes2number(message.slice(3, 4));
        let sender = bytes2string(message.slice(4, 8));
        let numberOfPeers = bytes2number(message.slice(8, 12));
        let peerList = {};

        for (var i = 0; i < numberOfPeers; i++) {
            let peerPort = bytes2number(message.slice(14 + i*8, 16 + i*8));
            let peerIP = bytes2number(message.slice(16 + i*8, 17 + i*8)) + '.'
                + bytes2number(message.slice(17 + i*8, 18 + i*8)) + '.'
                + bytes2number(message.slice(18 + i*8, 19 + i*8)) + '.'
                + bytes2number(message.slice(19 + i*8, 20 + i*8));
            let joiningPeer = {'port': peerPort, 'IP': peerIP};
            let peerAddress = peerIP + ':' + peerPort;
            peerList[peerAddress] = joiningPeer;

            // Update unpeerTable
            if (!(peerAddress in unpeerTable))
                unpeerTable[peerAddress] = joiningPeer;
        }

        if (msgType == 1) {
            isFull[client.remotePort] = false;
            console.log("Connected to peer " + sender + ":" + client.remotePort + " at timestamp: " + singleton.getTimestamp());

            // add the server (the receiver request) into the table
            let receiverPeer = {'port': client.remotePort, 'IP': client.remoteAddress};
            let peerAddress = receiverPeer.IP + ':' + receiverPeer.port;
            peerTable[peerAddress] = receiverPeer;
            unpeerTable[peerAddress] = {'port': client.remotePort, 'IP': client.remoteAddress, 'status': 'peered'}

            console.log("Received ack from " + sender + ":" + client.remotePort);
            Object.values(peerList).forEach(peer => {
                console.log("  which is peered with: " + peer.IP + ":" + peer.port);
            });
        } else {
            console.log("Received ack from " + sender + ":" + client.remotePort);
            isFull[client.remotePort] = true;
            Object.values(peerList).forEach(peer => {
                console.log("  which is peered with: " + peer.IP + ":" + peer.port);
            });
            console.log("Join redirected, try to connect to the peer above.");
        
            // remove the server (the receiver request) into the table
            let peerAddress = client.remoteAddress + ':' + client.remotePort;
            delete peerTable[peerAddress];
            unpeerTable[peerAddress] = {'port': client.remotePort, 'IP': client.remoteAddress, 'status': 'declined'}
        }
    }); 
}

function handleClient(sock, sender, peer, peerTable, unpeerTable) {
    // accept client request
    addClient(peer, peerTable, unpeerTable);

    // send acknowledgment to the client
    cPTPpacket.init(1, sender, peerTable);
    sock.write(cPTPpacket.getPacket());
    sock.end();
}

function declineClient(sock, sender, peerTable, unpeerTable) {
    let peerAddress = sock.remoteAddress + ':' + sock.remotePort;
    unpeerTable[peerAddress] = {'port': sock.remotePort, 'IP': sock.remoteAddress};
    console.log('\nPeer table full: ' + peerAddress + ' redirected');

    // send acknowledgment to the client
    cPTPpacket.init(2, sender, peerTable);
    sock.write(cPTPpacket.getPacket());
    sock.end();
}

function addClient(peer, peerTable, unpeerTable) {
    let peerAddress = peer.IP + ':' + peer.port;
    peerTable[peerAddress] = peer;
    unpeerTable[peerAddress] = {'port': peer.port, 'IP': peer.IP, 'status': 'peered'};
    console.log('\nConnected from peer ' + peerAddress);
}

function bytes2string(array) {
    var result = "";
    for (var i = 0; i < array.length; ++i) {
        if (array[i] > 0)
            result += (String.fromCharCode(array[i]));
    }
    return result;
}

function bytes2number(array) {
    var result = "";
    for (var i = 0; i < array.length; ++i) {
        result ^= array[array.length - i - 1] << 8 * i;
    }
    return result;
}