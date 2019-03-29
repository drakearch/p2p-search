
// necessary declarations
var ITPVersion = 3314;
var messageType = "1";
var senderID = "p";
var port = 0;
var IP = 0;
var numOfPeers = 0;
var packetResponse;

function decimalToHexString(number) // needed due to size limit of buffer
{
    if (number < 0)
    {
        number = 0xFFFFFFFF + number + 1;
    }
    return (number.toString(16).toUpperCase());
}

module.exports = {

    init: function(portOG,senderOG,IPOG,numOfPeersOG,messageTypeOG) { // get data

        // set data
        senderID = senderOG;
        port = portOG;
        IP = IPOG;
        numOfPeers = numOfPeersOG;
        messageType = messageTypeOG;
    },

    //--------------------------
    //getlength: return the total length of the ITP packet
    //--------------------------
    getLength: function() {
        // proved to be unecessary since the buffers allocates only the maximum number of bytes
        return "length of ITP packet";
    },

    //--------------------------
    //getpacket: returns the entire packet
    //--------------------------
    getPacket: function() {
        // create new buffer for the ITP request packet header
        packetResponse = new Buffer.alloc(20);
        // write necessary data to buffer
        // convert some decimals into hexString to fit in buffer
        ITPVersion = decimalToHexString(ITPVersion);
        IP = decimalToHexString(parseInt(IP,10));
        packetResponse.write(ITPVersion,0,3);
        packetResponse.write(messageType,3,1);
        packetResponse.write(senderID,4,4);
        packetResponse.write(numOfPeers,8,4);
        packetResponse.write(port,12,4);
        packetResponse.write(IP,16,4);
        return packetResponse;
    }
};