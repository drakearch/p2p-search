// necessary declarations
var ts = 0;
var sn = 0;
module.exports = {
    init: function() {
       ts = Math.round(Math.random() * (999 - 1) + 1); // initializes a timestamp number from 1 to 999
       sn = Math.round(Math.random() * (999 - 1) + 1); // initializes a sequence number from 1 to 999
       setInterval(function(){ts++;},10); // increments timestamp number every 10 ms
    },
    
    //--------------------------
    //getSequenceNumber: return the current sequence number + 1
    //--------------------------
    getSequenceNumber: function() {
        sn += 1;
        return (sn + "");
    },

    //--------------------------
    //getTimestamp: return the current timer value
    //--------------------------
    getTimestamp: function() {
        return (ts + "");
    }


};