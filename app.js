var fs = require('fs');
var request = require('request');

const port = process.env.PORT || 8080; // for heroku compilation and local server
var express = require("express");
const serv = express()
    .use(express.static(__dirname))
    .get("/", (req,res) => res.sendFile(__dirname+'/io-map.html') )
    .listen(port, () => console.log('Server started on '+port+'!'));

var io = require('socket.io')(serv);

const PATH_TO_DATA_MAP = 'reduced/Io/';

io.sockets.on('connection', function (socket) {
    console.log("Client connected");
    socket.emit('connect');

    socket.on('disconnect', function () {
        console.log('Client disconnect');
    });

    socket.on('dates', function(){

        fs.readdir(PATH_TO_DATA_MAP, (err, files) => {

            var dates = new Set();
            files.forEach(file => {
                try {
                    var t = file.toString().match(/(\d+)(\D+)(\d+)/);

                    if (t != null) {
                        // console.log(t)
                        var month = (['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(t[2])+1).toString();
                        if (month.length != 2) {
                            month = "0"+month;
                        }
                        var day = t[3];
                        if (day.length != 2) {
                            day = "0"+day;
                        }
                        var year = t[1];
                        dates.add(month+"-"+day+"-"+year);
                    }

                }

                catch(err) {
                    console.log(err);
                }
            })

            socket.emit("dates", Array.from(dates));

        });
    });

    socket.on('data', function(_date)
    {
        var date = _date.split("-");
        var month = (['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'])[parseInt(date[1])-1];
        var day = parseInt(date[2].slice(0,2)).toString();
        if (day.length == 1) day = "0"+day;
        var year = date[0];

        var filepaths = [];

        var dir = PATH_TO_DATA_MAP+year+month+day+"/";

        fs.readdir(dir, (err, files) => {

            files.forEach(F => {
                var file = F.toString();

                // Checking whether image matches format FILTER_hhmmUT
                var fileAttr = file.match(
                    /\_(?:BrA|Bra|Brac|BrAc|H2O|h2o|Kc|Lp|Ms|PAH|pah)\_(\d\d)(\d\d)UT\./
                );

                if (fileAttr != null) {
                    // console.log(file);
                    filepaths.push(file);
                }
                else {
                    console.log("File mis-formatted: ", dir, file);
                }
            })


            try {

                /*
                Methods for querying the JPL Horizons database.

                Instructions for keyowrds and options available here:
                ftp://ssd.jpl.nasa.gov/pub/ssd/horizons_batch_example.long

                Adapted from:
                v0: M. Adamkovics
                v1: K. de Kleer

                input name of taret as string, e.g. 'Io', and date in the format:
                '\'YYYY-MM-DD HH:MM\''
                For example: data=get_ephem.get_ephemerides('Io','\'2017-06-09 08:24\'')
                Returns a list containing (in string format):
                UTdate,UTtime,sun,moon,RA (J2000),DEC (J2000),Airmass,Extinction,Ang-Diam("),Ob-lon,Ob-lat,NP.ang,NP.dist
                */

                var code = {'Mercury':'199', 'Venus':'299', 'Earth':'399', 'Mars':'499',
                'Jupiter':'599', 'Io':'501', 'Europa':'502', 'Ganymede':'503',
                'Saturn':'699', 'Uranus':'799', 'Neptune':'899','Callisto':'504'};
                var target = "Io";

                var results = [];

                // figure out the month and day up here; all that changes is the time
                month = (['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(month)+1);
                var DiM = 0;
                if (month == 2) { if (parseInt(year)%4 != 0) {DiM = 28;} else {DiM=29;} }
                else if (month == 4 || month == 6 || month == 9 || month == 11) {DiM = 30;}
                else {DiM = 31;}

                var Dt = parseInt(day)+1;
                var dmonth = false;
                if (Dt > DiM) {
                    dmonth = true;
                    Dt = 1;
                    if (month > 12) {
                        year += 1;
                        month = 1;
                    }
                }
                Dt=Dt.toString();
                if(Dt.length == 1) Dt = "0"+Dt;

                var tstart_UT = ["'",year,"-",
                month,"-",
                day," ",
                "00:00'"].join("");

                if(dmonth){month++}

                var tend_UT =
                [
                    "'",year,"-",month,"-",Dt,
                    " ",
                    "00:00'"
                ].join("");

                var geturl =
                [
                    "http://ssd.jpl.nasa.gov/horizons_batch.cgi?batch=1",
                    "&MAKE_EPHEM='YES'&TABLE_TYPE='OBSERVER'",
                    "&COMMAND=", code[ target ],
                    "&CENTER='568'", //568 = mauna kea
                    "&START_TIME=",tstart_UT,
                    "&STOP_TIME=",tend_UT,
                    "&STEP_SIZE='1 hour'", // front-end JS rounds to the nearest hour
                    "&QUANTITIES='1,8,13,14,17'", //
                    "&CSV_FORMAT='YES'"
                ].join("");

                console.log(geturl);

                var ephem = null;
                // request data. just do it once, to save time
                request({uri: geturl,}, function(error, response, body) {
                    try {
                        ephem = body.toString();
                        // 24 sets of position data, one for each hour
                        var results = ephem.match(/\$\$SOE\n\s(.*\,\n)+\$\$EOE/)[0].split("\n");

                        var data = {
                            directory: dir,
                            files: filepaths,
                            location: results
                        };

                        io.emit('data',data);

                    }

                    catch (err) {
                        console.log(
                            "JPL request threw error", err,
                            "\nurl: ", geturl
                        );
                    }
                });

            }

            catch(err) {
                console.log(err);
            }

        });

    });

});
