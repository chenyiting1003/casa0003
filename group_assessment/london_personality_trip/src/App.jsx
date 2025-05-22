import React, { useState, useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./App.css";
import RouteDetailsAccordion from "./components/RouteDetailsAccordion.jsx";
import './components/RouteDetailsAccordion.css';
import { useNavigate } from "react-router-dom";



mapboxgl.accessToken = "pk.eyJ1IjoidWNmbmhiZyIsImEiOiJjbTZnZnV5cjEwMHZyMmxzYm50NDFpZnZtIn0.avm3fmwvzK3wOTLbezZjBQ"

function App() {
  const mapContainer = useRef(null); 
  const map = useRef(null); 
  const startMarker = useRef(null);

  const [tags, setTags] = useState([]);
  const [seasons, setSeasons] = useState([]); 
  const [popular, setPopular] = useState(""); 
  const [charge, setCharge] = useState("both"); 
  const [startCoord, setStartCoord] = useState(null); 

  const [routeTrip, setRouteTrip] = useState(null);
  const [selectedFeatures, setSelectedFeatures] = useState([]);

  const navigate = useNavigate();

  const [showNavPrompt, setShowNavPrompt] = useState(false);
  const [isGoogleNavMode, setIsGoogleNavMode] = useState(false);



const isValidCoord = (coord) =>
  Array.isArray(coord) &&
  coord.length === 2 &&
  typeof coord[0] === "number" &&
  typeof coord[1] === "number" &&
  !isNaN(coord[0]) &&
  !isNaN(coord[1]);



  
  const allTags = [
    "Modern landmarks", "Museums", "Art galleries", "Historical landmarks",
    "Park and gardens", "Musical and theatre", "Shopping districts",
    "Royal family and palaces", "Church spirtual"
  ]
  const allSeasons = ["spring", "summer", "autumn", "winter"]

  const toggle = (val, list, setList) => {
    setList(list.includes(val) ? list.filter(v => v !== val) : [...list, val])
  }


// start point + Marker
const setStartPoint = (coord) => {
  if (!isValidCoord(coord)) {
    console.warn("Invalid coordinate passed to setStartPoint:", coord);
    return;
  }

  setStartCoord(coord);

  if (startMarker.current) startMarker.current.remove();

  startMarker.current = new mapboxgl.Marker({ color: "#f36b1c" })
    .setLngLat(coord)
    .addTo(map.current);

  console.log("Start point set:", coord);
};


  
const useCurrentLocation = () => {
  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  navigator.geolocation.getCurrentPosition(pos => {
    const coord = [pos.coords.longitude, pos.coords.latitude];
    setStartPoint(coord);

    if (isValidCoord(coord)) {
      map.current.flyTo({ center: coord, zoom: 14 });
    } else {
      console.warn("Skipping flyTo due to invalid coord:", coord);
    }
  }, () => {
    alert("Failed to get your location");
  });
};


  
  // click the map to choose start location
  const setupMapClickToSetStartPoint = () => {
    map.current.on("click", (e) => {
      const coord = [e.lngLat.lng, e.lngLat.lat];
      setStartPoint(coord);
    });
  };



  // set up landmarks layer and popup
  const setupLandmarkLayer = () => {
    map.current.addSource("landmarks", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.current.addLayer({
      id: "landmark-points",
      type: "circle",
      source: "landmarks",
      paint: {
        "circle-radius": 10,
        "circle-color": "#8E6CFF",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });


      let popup;


  map.current.on("mouseenter", "landmark-points", (e) => {
    map.current.getCanvas().style.cursor = "pointer";
    const p = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates;
    const html = `
      <strong>${p.name}</strong><br/>
      Type: ${p.type}<br/>
      Tags: ${p.Tags}<br/>
      Season: ${p.BestSeason}<br/>
      Popular: ${p.Popular}<br/>
      Charge: ${p.Charge}
    `;
    popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
    })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map.current);
  });

  map.current.on("mouseleave", "landmark-points", () => {
    map.current.getCanvas().style.cursor = "";
    if (popup) popup.remove();
  });
};

// restart the map and all the fuction
const initializeMap = () => {
  map.current = new mapboxgl.Map({
    container: mapContainer.current,
    style: "mapbox://styles/ucfnhbg/cmamm5hrq00du01s50qgg2zdx/draft",
    center: [-0.12, 51.5],
    zoom: 11,
    minZoom: 9,   
    maxZoom: 17,   
    maxBounds: [    
      [-0.21, 51.47], 
      [-0.01, 51.54]   
    ]
  });

  map.current.on("load", () => {
  setupLandmarkLayer();

});


  setupMapClickToSetStartPoint();
};


useEffect(() => {
  if (map.current) return;
  initializeMap();
}, []);


// if something wrong, restart the web
const resetAll = () => {
  navigate(0);  
};



//filter logic fuction
const handleFilter = async () => {
  const res = await fetch("/label_points.geojson");
  const geojson = await res.json();

  if (!isValidCoord(startCoord)) {
  alert("Please reselect a starting point on the map before applying filters.");
  return;
}

  //tag、season、popular、charge 
  const filtered = {
    type: "FeatureCollection",
    features: geojson.features.filter((f) => {
      const p = f.properties;

      const tagMatch =
        tags.length === 0 ||
        tags.some((tag) => p.Tags.toLowerCase().includes(tag.toLowerCase()));
      const seasonMatch =
        seasons.length === 0 ||
        seasons.some((season) =>
          p.BestSeason?.toLowerCase().includes(season.toLowerCase())
        );
      const popularMatch = !popular || String(p.Popular) === popular;
      const chargeMatch =
        charge === "yes" ||
        (charge === "no" && p.Charge.toLowerCase() === "no");

      return tagMatch && seasonMatch && popularMatch && chargeMatch;
    }),
  };

  // if no result
  if (filtered.features.length === 0) {
    const center = map.current.getCenter();

    const noMatchPopup = new mapboxgl.Popup()
      .setLngLat([center.lng, center.lat])
      .setHTML(`
        <div style="max-width: 220px;">
          <p><strong>Sorry, no places match your preferences.</strong></p>
          <p>Please try broadening your selection.</p>
          <button id="reset-button" style="
            margin-top: 0.5rem;
            padding: 6px 12px;
            background-color: #f36b1c;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">Start Over</button>
        </div>
      `)
      .addTo(map.current);

    setTimeout(() => {
      const resetBtn = document.getElementById("reset-button");
      if (resetBtn) {
        resetBtn.onclick = () => {
          resetAll();
          noMatchPopup.remove();
        };
      }
    }, 100);

    return;
  }

  // show the result
  map.current.getSource("landmarks").setData(filtered);

  // build a route
  buildOptimizedRoute(filtered.features);

};

// route fuction
const buildOptimizedRoute = async (features) => {
  if (!isValidCoord(startCoord)) {
    alert("Please click on the map to select a valid start point first.");
    return;
  }

  const maxDistance = 2000; 

  // distance fuction
  const getDistance = (coord1, coord2) => {
    const toRad = deg => (deg * Math.PI) / 180;
    const [lng1, lat1] = coord1;
    const [lng2, lat2] = coord2;

    const R = 6371e3;
    const φ1 = toRad(lat1), φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lng2 - lng1);

    const a = Math.sin(Δφ / 2) ** 2 +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // if there are points less than 2000m
  const nearby = features.filter(f => getDistance(startCoord, f.geometry.coordinates) <= maxDistance);
  if (nearby.length === 0) {
    const center = map.current.getCenter();
    const noNearbyPopup = new mapboxgl.Popup()
      .setLngLat([center.lng, center.lat])
      .setHTML(`
        <div style="max-width: 220px;">
          <p><strong>Sorry, no places are within 2km for walking route.</strong></p>
          <p>Please restart with broader selection or pick another starting point.</p>
          <button id="reset-button" style="
            margin-top: 0.5rem;
            padding: 6px 12px;
            background-color: #f36b1c;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">Start Over</button>
        </div>
      `)
      .addTo(map.current);

    setTimeout(() => {
      const btn = document.getElementById("reset-button");
      if (btn) btn.onclick = () => {
        resetAll();
        noNearbyPopup.remove();
      };
    }, 100);
    return;
  }

  // select the closest point and ≤ 2000m
  const selected = [];
  const visited = new Set();
  let currentCoord = startCoord;

  while (selected.length < 10) {
    // continue...
    let next = null;
    let minDist = Infinity;

    for (let f of features) {
      const key = f.geometry.coordinates.join(",");
      if (visited.has(key)) continue;

      const dist = getDistance(currentCoord, f.geometry.coordinates);
      if (dist <= maxDistance && dist < minDist) {
        minDist = dist;
        next = f;
      }
    }

    if (!next) break; 

    selected.push(next);
    visited.add(next.geometry.coordinates.join(","));
    currentCoord = next.geometry.coordinates;
  }

  // data to mapbox api = start points + select points
  const coords = [startCoord, ...selected.map(f => f.geometry.coordinates)];
  const coordString = coords.map(c => c.join(",")).join(";");
  const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/walking/${coordString}?geometries=geojson&overview=full&roundtrip=false&source=first&destination=last&access_token=${mapboxgl.accessToken}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!data.trips || data.trips.length === 0) {
      alert("Failed to generate walking route. Please try again.");
      return;
    }


    const trip = data.trips[0];
    setRouteTrip(trip);
    setSelectedFeatures([...selected]);

    //导航选项卡
    setShowNavPrompt(true);



    const routeGeojson = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: trip.geometry,
        properties: {}
      }]
    };

    if (!map.current.getSource("route")) {
      map.current.addSource("route", {
        type: "geojson",
        data: routeGeojson
      });

      map.current.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round"
        },
        paint: {
          "line-color": "#F29B7A",
          "line-width": 5,
          "line-opacity": 0.8
        }
      });
    } else {
      map.current.getSource("route").setData(routeGeojson);
    }

    console.log("Final walk path:", coords);




  } catch (error) {

    console.log("Sending Optimization API request");
    console.log("trip", trip);
console.log("selected", selected);

console.log("Start Coord:", startCoord);
console.log("Features:", features);
console.log("All coords:", [startCoord, ...features.map(f => f.geometry.coordinates)]);
console.log("Coord string:", coordString);
console.log("URL:", url);
console.error("Optimization error:", error);

  }
};



return (
  <>
    {/* main body */}
  
{showNavPrompt && (
  <div style={{
    position: "absolute",
    right: "20px",
    bottom:"80px",
    zIndex: 999,
    backgroundColor: "#fff8f2",
    border: "1px solid #ccc",
    borderRadius: "8px",
    padding: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    maxWidth: "240px"
  }}>
    <div style={{ marginBottom: "8px", fontWeight: "bold" }}> Start walking navigation?</div>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>


<button
  onClick={() => {
    setShowNavPrompt(false);
    setIsGoogleNavMode(true);

    const coords = [startCoord, ...selectedFeatures.map(f => f.geometry.coordinates)];
    const gmapUrl = `https://www.google.com/maps/dir/?api=1&origin=${coords[0][1]},${coords[0][0]}&destination=${coords[coords.length - 1][1]},${coords[coords.length - 1][0]}&waypoints=${coords.slice(1, -1).map(c => `${c[1]},${c[0]}`).join('|')}&travelmode=walking`;

    window.open(gmapUrl, "_blank");
  }}
  style={{
    padding: "6px 10px",
    fontSize: "14px",
    backgroundColor: "#f36b1c",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer"
  }}
>
  Start Navigation
</button>


      <button
        onClick={() => setShowNavPrompt(false)}
        style={{
          padding: "6px 10px",
          fontSize: "14px",
          backgroundColor: "#eee",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer"
        }}
      >
        Cancel
      </button>
    </div>
  </div>
)}

  <div style={{ display: "flex", height: "100vh", position: "relative" }}>   

      {/* left panel */}
      <div style={{
        width: "30%",
        padding: "1rem",
        overflowY: "auto",
        borderRight: "1px solid #ccc",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>

        {/* title */}
<h2 style={{ 
  fontFamily: "'Merriweather', serif", 
  color: "#000", 
  fontSize: "22px",
  marginTop: "20px",
  marginBottom: "20px",
  textAlign: "center"
   }}>
  Plan Your London Route!
</h2>

{/* start point */}
<div className="bubble assistant" style={{ 
  display: "flex", 
  fontSize: "14px",
  justifyContent: "space-between", 
  alignItems: "center" }}>
  <strong>Please select a starting point on the map</strong>
  <button
    onClick={useCurrentLocation}
    style={{
      marginLeft: "10px",
      background: "#e28b6a",
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      padding: "6px 10px",
      fontSize: "14px",
      cursor: "pointer"
    }}
  >
    Use My Location
  </button>
</div>



  {/* fliter */}
  <div className="bubble assistant" style={{ fontSize: "14px" }}>
    <strong>What kind of places do you love most?</strong>
    <div style={{ marginTop: "14px" }}>
      {allTags.map(tag => (
        <label key={tag} style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={tags.includes(tag)}
            onChange={() => toggle(tag, tags, setTags)}
          />
          {" " + tag}
        </label>
      ))}
    </div>
  </div>


  <div className="bubble assistant" style={{ fontSize: "14px" }}>
    <strong>Which season do you plan to visit London?</strong>
    <div style={{ marginTop: "8px" }}>
      {allSeasons.map(season => (
        <label key={season} style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={seasons.includes(season)}
            onChange={() => toggle(season, seasons, setSeasons)}
          />
          {" " + season}
        </label>
      ))}
    </div>
  </div>


  <div className="bubble assistant" style={{ fontSize: "14px" }}>
    <strong>Do you prefer famous places or hidden gems?</strong>
    <div style={{ marginTop: "8px" }}>
      {[
        { label: "Less-known", value: "1" },
        { label: "Well-known", value: "3" },
      ].map(opt => (
        <label key={opt.value} style={{ display: "block" }}>
          <input
            type="radio"
            name="popular"
            value={opt.value}
            checked={popular === opt.value}
            onChange={() => setPopular(opt.value)}
          />
          {" " + opt.label}
        </label>
      ))}
    </div>
  </div>


  <div className="bubble assistant" style={{ fontSize: "14px" }}>
    <strong>Are you okay with ticketed (paid) attractions?</strong>
    <div style={{ marginTop: "8px" }}>
      {["yes", "no"].map(opt => (
        <label key={opt} style={{ display: "block" }}>
          <input
            type="radio"
            name="charge"
            value={opt}
            checked={charge === opt}
            onChange={() => setCharge(opt)}
          />
          {" " + (opt === "yes" ? "Yes" : "No")}
        </label>
      ))}
    </div>
  </div>

  {/* button */}
  <div className="bubble assistant" style={{ display: "flex", gap: "20px", justifyContent: "space-between" }}>
    <button
      onClick={handleFilter}
      style={{
        padding: "8px 2px",
        flex: 1,
        background: "#e28b6a",
        color: "#fff",
        border: "none",
        borderRadius: "6px"
      }}
    >
      Apply Filters
    </button>
    <button
      onClick={resetAll}
      style={{
        padding: "8px 2px",
        flex: 1,
        background: "#ccc",
        border: "none",
        borderRadius: "6px"
      }}
    >
      Restart
    </button>
  </div>

</div>


        {/* map */}
        <div
          ref={mapContainer}
          style={{ width: "70%", height: "100%", position: "relative", zIndex: 0 }}
        ></div>

      </div>

      {/* detail card of route*/}
    {!isGoogleNavMode && routeTrip && (      
      <div
        id="route-details"
        style={{
          position: "absolute",
          top: "90px",
          right: "10px",
          width: "20%",
          height: "40%",
          overflowY: "auto",
          background: "#f6f1ec83",
          borderRadius: "8px",
          padding: "10px",
          fontSize: "13px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          zIndex: 10,
        }}
      >

        <RouteDetailsAccordion 
          trip={routeTrip} 
          selected={selectedFeatures} 
          map={map.current}
        />
      </div>
     )}     


    </>
  );
}

export default App
