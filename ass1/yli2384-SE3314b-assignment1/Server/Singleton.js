
// Some code needs to added that are common for the module

var d = new Date();
var p;

module.exports = {


    init: function() {

        p = d.getTime();
        // var test = Date.getSeconds();
        // start = Date.now();
       // init function needs to be implemented here //
    },

    //--------------------------
    //getSequenceNumber: return the current sequence number + 1
    //--------------------------
    getSequenceNumber: function() {

      // Enter your code here //
        return "this should be a correct sequence number";
    },

    //--------------------------
    //getTimestamp: return the current timer value
    //--------------------------
    getTimestamp: function() {
        // return d.getTime() - p;
        return d.getTime()%100000;
    }


};