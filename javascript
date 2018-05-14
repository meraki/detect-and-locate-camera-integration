// This Node-RED template renders a client object/s and associated parameters on a Google Map
(function ($) {
  
  var map,                                      // Google map
    clientMarker,                               // Client marker when following a single client
    clientUncertaintyCircle,                    // Client circle representing client location uncertainty
    lastEvent,                                  // Most recent scheduled polling task
    lastInfoWindowMac,                          // Most recent MAC displayed in a marker tooltip
    allMarkers = [],                            // Markers array when we are in "View All" context
    lastMac = "",                               // Most recent requested MAC to follow
    infoWindow = new google.maps.InfoWindow();  // Client marker tooltip

    var latlngbounds = new google.maps.LatLngBounds();

// Removes all markers
  function clearAll() {
    clientMarker.setMap(null);
    clientUncertaintyCircle.setMap(null);
    lastInfoWindowMac = "";
    var m;
    while (allMarkers.length !== 0) {
      m = allMarkers.pop();
      if (infoWindow.anchor === m) {
        lastInfoWindowMac = m.mac;
      }
      m.setMap(null);
    }
  }

// Plots the location and uncertainty for a single MAC address
  function track(client) {
    clearAll();
    if (client !== undefined && client.lat !== undefined && (typeof client.lat !== 'undefined')) {
      var pos = new google.maps.LatLng(client.lat, client.lng);
      console.log('track client pos '+pos);
        if (client.manufacturer !== undefined) {
            mfrStr = client.manufacturer + " ";
        } else {
            mfrStr = "";
        }
        if (client.os !== undefined) {
            osStr = " running '" + client.os + "'";
        } else {
            osStr = "";
        }
        if (client.ssid !== undefined) {
            ssidStr = " with SSID '" + client.ssid + "'";
        } else {
            ssidStr = "";
        }
        if (client.floors !== undefined && client.floors !== "") {
            floorStr = " at " + client.floors + "'";
        } else {
            floorStr = "";
        }
      $('#last-mac').text(mfrStr  + lastMac + osStr  + ssidStr +
        " last seen on " + client.clastseen + floorStr +
        " with uncertainty " + client.unc.toFixed(1) + " metres (reloading every 60 seconds)");
      
      // Configure icon parameter based on type
        var iconType = "http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=W|ea4335|000000";
        if (client.type == "bluetooth") {
        iconType = "http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=B|4285f4|000000";
        }
        
      map.setCenter(pos);
      clientMarker.setMap(map);
      clientMarker.setPosition(pos);
      clientMarker.setIcon(iconType);
      
      clientUncertaintyCircle = new google.maps.Circle({
        map: map,
        center: pos,
        radius: client.unc,
        fillColor: 'Lime',
        fillOpacity: 0.25,
        strokeColor: 'Lime',
        strokeWeight: 1,
      });
      clientUncertaintyCircle.bindTo('center', clientMarker, 'position');
      map.fitBounds(clientUncertaintyCircle.getBounds());
        } else {
        $('#last-mac').text("Client '" + lastMac + "' could not be found");
    }
}

// Looks up a single MAC address
  function lookup(mac) {
    $.getJSON('/clients/' + mac, function (response) {
      track(response);
    });
  }

// Adds a marker for a single client within the "View All" context
  function addMarker(client) {
    var pos = new google.maps.LatLng(client.lat, client.lng);
    console.log('addMarker pos '+pos);
    
    // Configure icon parameter based on type
    var iconType = "http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=W|ea4335|000000";
    if (client.type == "bluetooth") {
        iconType = "http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=B|4285f4|000000";
    }
    
    // Create new marker
    var m = new google.maps.Marker({
        position: pos, 
        map: map,
        mac: client.mac,
        icon: iconType,
    }
    );
    
    if(client.lat){
        latlngbounds.extend(pos);
        map.fitBounds(latlngbounds);
        map.setZoom(20.5);
    }
    
    google.maps.event.addListener(m, 'click', function () {
        var htmlString = '<h3>Client:  '+client.name +'</h3>';
        
        for (var key in client) {
            if (client.hasOwnProperty(key)) {
                if(client[key] !== undefined){
                    if(key == '_id' || key == 'name' || key == 'ap' || key == 'epoch' || key == 'tag'){continue}
                    htmlString += '<p><b>'+key+'</b> : '+client[key]+'</p>';
                }
            }
        }
        
        infoWindow.setContent("<div>" + htmlString + "</div>" + "(<a class='client-filter' href='#' data-mac='" +
        client.mac + "'>Follow this client)</a>");

      infoWindow.open(map, m);
    });
    if (client.mac === lastInfoWindowMac) {
      infoWindow.open(map, m);
    }
    allMarkers.push(m);
  }

// Displays markers for all clients
  function trackAll(clients) {
    clearAll();
    if (clients.length === 0) {
      $('#last-mac').text("Found no clients (if you just started the web server, you may need to wait a few minutes to receive pushes from Meraki)");
    } else { 
      $('#last-mac').text("Found " + clients.length + " clients (reloading every 60 seconds)"); }
    clientUncertaintyCircle.setMap(null);
    clients.forEach(addMarker);
  }

// Looks up all client MAC addresses
  function lookupAll() {
    $('#last-mac').text("Looking up all clients...");
    $.getJSON('/clients/', function (response) {
      trackAll(response);
    });
  }

// Initiates a task timer to reload a single client MAC every 60 seconds
  function startLookup() {
    lastMac = $('#mac-field').val().trim();
    if (lastEvent !== null) { window.clearInterval(lastEvent); }
    lookup(lastMac);
    lastEvent = window.setInterval(lookup, 60000, lastMac);
  }

// Initiates a task timer to reload all client MACs every 60 seconds
  function startLookupAll() {
    if (lastEvent !== null) { window.clearInterval(lastEvent); }
    lastEvent = window.setInterval(lookupAll, 60000);
    lookupAll();
  }

// This is called after the DOM is loaded, so we can safely bind all the
// listeners here.
  function initialize() {
    var center = new google.maps.LatLng(-37.8136, 144.9631);
    var mapOptions = {
      center: center,
      mapTypeId: 'hybrid' //or roadmap, satellite, hybrid, terrain
    };
    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
    clientMarker = new google.maps.Marker({
      position: center,
      map: null,
    });
    clientUncertaintyCircle = new google.maps.Circle({
      position: center,
      map: null
    });

    $('#track').click(startLookup).bind("enterKey", startLookup);

    $('#all').click(startLookupAll);

    $(document).on("click", ".client-filter", function (e) {
      e.preventDefault();
      var mac = $(this).data('mac');
      $('#mac-field').val(mac);
      startLookup();
    });

    startLookupAll();
  }

// Call the initialize function when the window loads
  $(window).load(initialize);
}(jQuery));