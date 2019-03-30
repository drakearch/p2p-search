let net = require('net'),
    cPTPpacket = require('./cPTPmessage'),
    singleton = require('./Singleton');

let peerTable = {},
    peerList = {},
    firstPeerIP = {},
    firstPeerPort = {},
    isFull = {};


module.exports = {
    handleClientJoining: function (sock, maxPeers, sender, peerTable, unpeerTable) {
        sock.on('data', (message) => {
            // Data is <n ip_address:port
            var pattern = /^\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}:\d+$/;
            if (bytes2string(message).match( pattern )) {
                let addr = bytes2string(message).split(':');
                let peer = {'port': addr[1], 'IP': addr[0]};
                let peersCount = Object.keys(peerTable).length;
                if (peersCount === maxPeers) 
                    declineClient(sock, sender, peerTable, unpeerTable);
                else 
                    handleClient(sock, sender, peer, peerTable, unpeerTable)
            } else {

            }
        });
    },

    handleConnect: function (knownPeer, localPeer, maxPeers, peerLocation, peerTable, unpeerTable) {
        
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
};

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