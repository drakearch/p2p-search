// necessary declarations
var ITPpacket = require('./ITPpacketResponse');
var peerTable = "";
module.exports = {
    handleClientJoining: function (sock,IPOG,messageTypeOG,numOfPeersOG,myID,myPORT) {
        sock.on('data', function(reqdata) { // on data writing from a connected peer
            if(messageTypeOG == "1") // if message type is one
            {
                console.log("Connected from peer " + IPOG.toString() + ":" + reqdata.toString().split(":")[0]);
                ITPpacket.init(reqdata.toString().split(":")[0],reqdata.toString().split(":")[1],IPOG,numOfPeersOG.toString(),messageTypeOG.toString());
                peerTable += ITPpacket.getPacket().toString() + ":";
                sock.write(peerTable + myID + "." + myPORT.toString());
            }
            else
            {
                console.log("Peer table full: " + IPOG.toString() + ":" + reqdata.toString().split(":")[0] + " redirected");
                ITPpacket.init(reqdata.toString().split(":")[0],reqdata.toString().split(":")[1],IPOG,numOfPeersOG.toString(),messageTypeOG.toString());
                peerTable += ITPpacket.getPacket().toString() + ":";
                sock.write(peerTable + myID + "." + myPORT.toString());
            }
        });
        sock.on('close', function() { // on socket close
        });
    },
    setPeerTable:function(newPeerTable) // set peer table
    {
        peerTable += newPeerTable + "-";
    }
};


