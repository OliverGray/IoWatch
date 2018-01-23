"use strict";

b4w.register("io_map", function(exports, require) {

    var m_anchors = require("anchors");
    var m_data    = require("data");
    var m_app     = require("app");
    var m_cfg     = require("config");
    var m_cont    = require("container");
    var m_mouse   = require("mouse");
    var m_tex     = require("textures");
    var m_scenes  = require("scenes");
    var m_version = require("version");
    var m_transform = require("transform");

    var DEBUG = (m_version.type() === "DEBUG");

    const APP_ASSETS_PATH = "blend/";
    const PATH_TO_DEFAULT_MAP = APP_ASSETS_PATH + "mband.jpg";
    const PATH_TO_COLOR_MAP = APP_ASSETS_PATH + "map-color.jpg";
    const PATH_TO_DATA_MAP = APP_ASSETS_PATH + "data/export/";
    const PATH_TO_DEFAULT_MAP_SHELL = PATH_TO_DATA_MAP + "2017feb05/Io_Ms_1616.png"

    var _world = null;
    var _wait_for_image_loading = false;
    var _moon = null;
    var _shell = null;
    var _jupiter = null;
    var _sky = null;
    var _camera = null;

    var shell_active = false;
    var labels = true;

    var rotquat = [0,0,0,0];

    var heatmap = false;
    var active = "placeholder";
    var barinfo = false;

    // socket connection to active node server
    var _socket = io().connect();

    var OBJECT_NAMES = [
        "Amirani",
        "Loki",
        "Pele",
        "Isum Patera",
        "Volund",
        "Prometheus",
        "Culann Patera",
        "Kanehekili Fluctus",
        "Babbar Patera",
        "Janus Patera",
        "Tvashtar Paterae",
        "Uta Patera",
        "Zal Patera",
        "Tawhaki Patera",
        "Gish Bar Patera",
        "Marduk Fluctus",
        "Kurdalagon Patera",
        "Pillan Patera",
        "Rarog Patera"
    ];

    exports.init = function() {
        m_app.init({
            canvas_container_id: "canvas_cont",
            callback: init_cb,
            physics_enabled: false,
            alpha: true,
            show_fps: false,
            autoresize: true,
            assets_dds_available: !DEBUG,
            assets_min50_available: !DEBUG,
            console_verbose: true
        });
    }

    function showSidebar(side) {
        $("#sidebar").css("width","250px");
    }

    function hideSidebar() {
        $("#sidebar").css("width","0");
    }

    function showRSidebar(side) {
        $("#rsidebar").css("width","250px");
        $("#showSidebar").text("Hide Details");
        $("#interface").css("right","280px");
    }

    function hideRSidebar() {
        $("#rsidebar").css("width","0");
        $("#showSidebar").text("Show Details");
        $("#interface").css("right","30px");
        $("#canvas_cont .togbtn").css("box-shadow","0px 0px 10px 0px rgba(50, 50, 50, 0.5)");
        active="";
    }

    function togRSidebar() {
        if ($("#rsidebar").outerWidth() != 250) {
            showRSidebar();
        }
        else {
            hideRSidebar();
        }
    }

    $(".showSidebar").click(function() {
        if (active != "" || barinfo){
            togRSidebar();
        }
    });

    $("#togResearch").click(function() {
        if (!barinfo){
            $("#objdata").hide();
            $("#research").show();

            if (active != "") {
              showRSidebar();
            }
            else {
              togRSidebar();
            }
            active = "";
            barinfo = true;
            $("#togResearch").html("Hide Scientific Papers");
        }
        else {
            togRSidebar();
            barinfo = false;
            $("#togResearch").html("Show Scientific Papers");

        }
    });


    $("#labelMode").click(function() {
        if (labels) {
            $(".annotation").css("display","none");
            $(this).text("Show Labels");
            labels=false;
        }
        else {
            $(".annotation").css("display","block");
            $(this).text("Hide Labels");
            labels=true;
        }
    })

    function init_cb(canvas_elem, success) {

        if (!success) {
            console.log("b4w init failure");
            return;
        }

        m_cfg.set("background_color", new Float32Array([0.0, 0.0, 0.0, 0.0]));
        m_cfg.set("alpha", true);

        for (var i = 0; i < OBJECT_NAMES.length; i++) {
            var volcano = OBJECT_NAMES[i];
            // console.log(volcano);
            generate_anchor(volcano);
        }

        m_data.load(APP_ASSETS_PATH+"io_model.json", load_cb);
    }


    function init_network(){
        console.log("init_network");

        _socket.on('connect', function () {
            console.log("connected");
        });

        var filters = ['bra','brac','h2o','kc','lp','ms','PAH']

        filters.forEach(filter => {
            $("#"+filter+"d").hide();
        })

        _socket.on("dates", function(dates) {
            // console.log(dates);

            $( "#datepicker" ).datepicker({
                dateFormat: "yy-mm-dd",
                changeYear: true,
                changeMonth: true,
                beforeShowDay: function (d) {
                    var dmy = (d.getMonth()+1);
                    if(d.getMonth()<9)
                        dmy="0"+dmy;
                    dmy+= "-";

                    if(d.getDate()<10) dmy+="0";
                        dmy+=d.getDate() + "-" + d.getFullYear();

                    // console.log(dmy)
                    if (dates.includes(dmy)) {
                        return [true, 'highlight'];
                    }
                    else {
                        return [false, ''];
                    }
                }
            });

            $('#datepicker').change(function () {
                showSidebar();
                _socket.emit('data',$(this).datepicker("getDate"));
                return false;
            });

        });



        _socket.on('data', function(dat)
        {
            var xdata = false;
            var paths = dat.files;
            var filters = ['BrA','BrAc','h2o','Kc','Lp','Ms','PAH']

            filters.forEach(filter => {
                $("#"+filter+"d").hide();
            })

            paths.forEach(file => {
                var prefix = "#"+file.match(/Io_(.+)_/)[1];
                // console.log(prefix,dat.directory,file);
                try {
                    $(prefix).attr("src",dat.directory+file);
                    $(prefix+"d").show();

                    if (!xdata) {
                        m_tex.change_image(_shell, "datamap", $(prefix).attr("src"), change_img_cb);

                        // deselect();

                        var shadow = "0px 0px 25px rgba(255,255,255,1)";
                        $(prefix).css("-webkit-box-shadow",shadow);
                        $(prefix).css("box-shadow",shadow);
                        $(prefix).css("-moz-box-shadow",shadow);

                        xdata=true;
                    }
                }

                catch(err) {
                    $(prefix+"d").hide();
                    if (DEBUG) {
                      console.log(err);
                    }
                }

            })

            var values = {
                ob_lon:parseFloat(dat.location[8]),
                ob_lat:parseFloat(dat.location[9]),
                ob_np_ang:parseFloat(dat.location[10])
            };

            if(DEBUG) {
              console.log(paths,values);//
            }

            m_transform.set_rotation_euler(_shell,(90-values.ob_lat)*3.14159/180,(80+values.ob_np_ang)*3.14159/180,(90-values.ob_lon)*3.14159/180);
            m_transform.set_translation(_shell,0,0,0);

            shell_active = true;
            $("#togShell").text("Hide Shell");

            m_transform.set_translation(_camera, 10*Math.cos(values.ob_lon*3.14/180), -10*Math.sin(values.ob_lon*3.14/180), 0)
        });

        $("#togShell").click(function() {
            if (shell_active) {
                m_transform.set_translation(_shell,421,0,0);
                hideSidebar();
                $(this).text("Show Shell");
                shell_active = false;
            }

            else {
                // m_transform.set_translation(_shell,0,0,0);
                var date = $("#datepicker").datepicker("getDate");
                if (date != null) {
                    _socket.emit('data',date)
                    showSidebar();
                    $(this).text("Hide Shell");
                    shell_active = true;
                }
                else {
                    alert("No day selected!");
                }
            }
        });

        $("#canvas_cont .togbtn").click(function () {
            showRSidebar();

            if ($(this).text() != active) {
                var shadow = "0px 0px 25px rgba(0,156,200,1)";
                $("#canvas_cont .togbtn").css("box-shadow","0px 0px 10px 0px rgba(50, 50, 50, 0.5)");
                $(this).css("-webkit-box-shadow",shadow);
                $(this).css("box-shadow",shadow);
                $(this).css("-moz-box-shadow",shadow);

                var volname = $(this).text();
                var wikiname = "List_of_volcanic_features_on_Io";

                $("#objectLink").html("Object Selected:<br>"+volname);
                $("#research").hide();
                barinfo = false;
                $("#togResearch").html("Show Scientific Papers");

                $("#objdata").show();

                if(volname.split(" ")[1] == "Patera") {
                    wikiname = volname.replace(/ /g,"_");
                }
                else {
                    wikiname = volname+"_(volcano)";
                }

                $("#objectLink").attr("href","https://en.wikipedia.org/wiki/"+wikiname);
                active = $(this).text();

                $.ajax({
                    type: "GET",
                    url: "volcanoes.xml",
                    dataType: "xml",
                    success: function(xml) {
                        // console.log('get xml')
                        $(xml).find('feature').filter(function () {
                            return $(this).find("name").text() == active;
                        }).each(function() {
                            // console.log(this);
                            if ($(this).find("diameter").text() != "0") { var Di = "Diameter: "+$(this).find("diameter").text()+" km<br>"; } else { var Di = ""; }
                            var insertdata = [
                                Di,
                                "Central Latitude: ", $(this).find("centerlatitude").text(), "˚N<br>",
                                "Central Longitude: ", $(this).find("centerlongitude").text(), "˚W<br>",
                                "IAU Approval Status: ", $(this).find("approvalstatus").text(), ", since ", $(this).find("approvaldate").text(), "<br>",
                                "Origin: ", $(this).find("origin").text()
                                ].join("");
                            $("#objinfo").html(insertdata);
                        });

                    },
                    error: function(e) {
                        if (DEBUG) {
                          console.log(e);
                        }
                        $("#objinfo").html("");
                    }
                });
            }

            else {
                $("#canvas_cont .togbtn").css("box-shadow","0px 0px 10px 0px rgba(50, 50, 50, 0.5)");
                // $("#objdata").hide();
                hideRSidebar();
                active = "";
            }
        });

    }

    function deselect() {
        $("#canvas_cont .togbtn").css("box-shadow","0px 0px 10px 0px rgba(50, 50, 50, 0.5)");
        $(".dat").css("box-shadow","0px 0px 10px 0px rgba(50, 50, 50, 0.5)");
        active="";
    }

    function imagedata() {
        $(".imgdata").css("display","initial");
        $(".objdata").css("display","none");
    }

    function objectdata() {
        $(".imgdata").css("display","none");
        $(".objdata").css("display","none");
    }

    function generate_anchor(anchorname) {
        var newanchor = document.createElement("span");
        newanchor.id = anchorname;
        newanchor.className = "annotation togbtn"
        newanchor.innerHTML = anchorname;
        document.getElementById("canvas_cont").appendChild(newanchor);
        // console.log("creating new anchor:",anchorname);
    }

    // function move_anchor(anchorname, placement) {
    //     /* this doesn't work - anchors become greyed out on moving,
    //         as if behind an object. needs more research */
    //     var radlat = Math.PI*(placement[0])/180;
    //     var radlon = Math.PI*placement[1]/180;
    //     var posx = Math.cos(radlat)*Math.cos(radlon);
    //     var posy = Math.cos(radlat)*Math.sin(radlon);
    //     var posz = Math.sin(radlat);
    //     console.log(anchorname,posx,posy,posz);
    //     m_transform.set_translation_rel(m_scenes.get_object_by_name(anchorname, posx, posy, posz));
    // }

    function load_cb(data_id) {
        m_app.enable_camera_controls();
        init_network();  // sets up socket.io communication
        _socket.emit("dates");
        var container = m_cont.get_canvas();
        _world = m_scenes.get_world_by_name("World");
        _moon = m_scenes.get_object_by_name("Io"); // Io
        _shell = m_scenes.get_object_by_name("Shell"); // Data shell
        _jupiter = m_scenes.get_object_by_name("Jupiter");
        _camera = m_scenes.get_object_by_name("Camera")
        // _sky = m_scenes.get_object_by_name("Sphere");
        $("#mapType").click(main_maptype_clicked_cb);
        m_tex.change_image(_moon, "map", PATH_TO_COLOR_MAP, change_img_cb);
        m_transform.set_translation(_shell,421,0,0);
        // m_tex.change_image(_shell, "datamap", PATH_TO_DEFAULT_MAP_SHELL, change_img_cb);
        // m_tex.change_image(_sky, "Texture", APP_ASSETS_PATH+"TychoSkymapII_t3.jpg", change_img_cb);
        m_tex.change_image(_jupiter, "jupiter", APP_ASSETS_PATH+"jupiter-cylindrical-map-created-with-cassini-data.jpg", change_img_cb);


        $(".dat").click(function(){
            m_tex.change_image(_shell, "datamap", $(this).attr("src"), change_img_cb);

            deselect();

            var shadow = "0px 0px 25px rgba(255,255,255,1)";
            $(this).css("-webkit-box-shadow",shadow);
            $(this).css("box-shadow",shadow);
            $(this).css("-moz-box-shadow",shadow);
        });
        // console.log('moving volcanes!');

    }

    function change_img_cb() {
        _wait_for_image_loading = false;
    }

    // function update_shell(datimg) {
    //     m_tex.change_img(_shell, "datamap", $(datimg).src, change_img_cb);
    // }

    function main_maptype_clicked_cb() {

        if (heatmap) {
            m_tex.change_image(_moon, "map", PATH_TO_COLOR_MAP, change_img_cb);
            heatmap = false;
            $("#mapType").text("View Infrared Maps");
        }
        else {
            m_tex.change_image(_moon, "map", PATH_TO_DEFAULT_MAP, change_img_cb);
            heatmap = true;
            $("#mapType").text("View Color Maps");
        }
    }

});

b4w.require("io_map").init();