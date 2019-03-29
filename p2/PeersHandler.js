let net = require('net'),
    cPTPpacket = require('./cPTPmessage'),
    singleton = require('./Singleton');

let peerTable = {},
    firstPeerIP = {},
    firstPeerPort = {},
    isFull = {};


module.exports = {
    handleClientJoining: function (sock, maxPeers, sender, peerTable) {
        let peersCount = Object.keys(peerTable).length;
        if (peersCount === maxPeers) {
            declineClient(sock, sender, peerTable);
        } else {
            handleClient(sock, sender, peerTable)
        }
    },

    handleCommunications: function (client, maxPeers, location, peerTable) {
        // get message from server

        client.on('data', (message) => {
            let version = bytes2number(message.slice(0, 3));
            let msgType = bytes2number(message.slice(3, 4));
            let sender = bytes2string(message.slice(4, 8));
            let numberOfPeers = bytes2number(message.slice(8, 12));/*
            let reserved = bytes2number(message.slice(12, 14));
            let peerPort = bytes2number(message.slice(14, 16));
            let peerIP = bytes2number(message.slice(16, 17)) + '.'
                + bytes2number(message.slice(17, 18)) + '.'
                + bytes2number(message.slice(18, 19)) + '.'
                + bytes2number(message.slice(19, 20));*/

            let peerList = {}
            for (var i = 0; i < numberOfPeers; ) {
                let peerPort = bytes2number(message.slice(14 + i*8, 16 + i*8));
                let peerIP = bytes2number(message.slice(16 + i*8, 17 + i*8)) + '.'
                    + bytes2number(message.slice(17 + i*8, 18 + i*8)) + '.'
                    + bytes2number(message.slice(18 + i*8, 19 + i*8)) + '.'
                    + bytes2number(message.slice(19 + i*8, 20 + i*8));
                let joiningPeer = {'port': peerPort, 'IP': peerIP};
                peerList[++i] = joiningPeer;
            }

            if (msgType == 1) {
                isFull[client.remotePort] = false;
                console.log("Connected to peer " + sender + ":" + client.remotePort + " at timestamp: " + singleton.getTimestamp());

                // add the server (the receiver request) into the table
                let receiverPeer = {'port': client.remotePort, 'IP': client.remoteAddress};
                let localPeer = {'port': client.localPort, 'IP': client.localAddress};
                peerTable[1] = receiverPeer;
                client.destroy();

                // Now run as a server
                let serverPeer = net.createServer();
                serverPeer.listen(localPeer.port, localPeer.IP);
                console.log('This peer address is ' + localPeer.IP + ':' + localPeer.port + ' located at ' + location);
                serverPeer.on('connection', function (sock) {
                    let peersCount = Object.keys(peerTable).length;
                    if (peersCount === maxPeers) {
                        declineClient(sock, location, peerTable);
                    } else {
                        handleClient(sock, location, peerTable)
                    }
                });

                console.log("Received ack from " + sender + ":" + client.remotePort);
                /*if ((numberOfPeers > 0) && (localPeer.port != peerPort))
                    console.log("  which is peered with: " + peerIP + ":" + peerPort);
                */
                Object.values(peerList).forEach(peer => {
                    console.log("  which is peered with: " + peer.IP + ":" + peer.port);
                });

            } else {
                console.log("Received ack from " + sender + ":" + client.remotePort);
                isFull[client.remotePort] = true;
                if (numberOfPeers > 0)
                    console.log("  which is peered with: " + peerIP + ":" + peerPort);
                console.log("Join redirected, try to connect to the peer above.");
            }
        });
        client.on('end', () => {
            if (isFull[client.remotePort]) process.exit();
        });

    }
};

function handleClient(sock, sender, peerTable) {
    // accept client request
    addClient(sock, peerTable);

    // send acknowledgment to the client
    cPTPpacket.init(1, sender, peerTable);
    sock.write(cPTPpacket.getPacket());
    sock.end();
}

function declineClient(sock, sender, peerTable) {
    let peerAddress = sock.remoteAddress + ':' + sock.remotePort;
    console.log('\nPeer table full: ' + peerAddress + ' redirected');

    // send acknowledgment to the client
    cPTPpacket.init(2, sender, peerTable);
    sock.write(cPTPpacket.getPacket());
    sock.end();
}

function addClient(sock, peerTable) {
    let peersCount = Object.keys(peerTable).length;
    let joiningPeer = {'port': sock.remotePort, 'IP': sock.remoteAddress};
    peerTable[++peersCount] = joiningPeer;

    let peerAddress = sock.remoteAddress + ':' + sock.remotePort;
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