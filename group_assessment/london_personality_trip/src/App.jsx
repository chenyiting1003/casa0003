import React, { useState, useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./App.css";

mapboxgl.accessToken = "pk.eyJ1IjoidWNmbmhiZyIsImEiOiJjbTZnZnV5cjEwMHZyMmxzYm50NDFpZnZtIn0.avm3fmwvzK3wOTLbezZjBQ"

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  const [tags, setTags] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [popular, setPopular] = useState("");
  const [charge, setCharge] = useState("both");

  const [startCoord, setStartCoord] = useState(null); // ✅ React状态保存起点坐标

  const useCurrentLocation = () => {
  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  navigator.geolocation.getCurrentPosition(pos => {
    const { longitude, latitude } = pos.coords;
    const coord = [longitude, latitude];

    setStartCoord(coord);

    if (map.current) {
      new mapboxgl.Marker({ color: "red" })
        .setLngLat(coord)
        .addTo(map.current);

      map.current.flyTo({ center: coord, zoom: 14 });
    }

    console.log("📍 Using current location:", coord);
  }, () => {
    alert("Failed to get your location");
  });
};

  const resetAll = () => {
    setTags([]);
    setSeasons([]);
    setPopular("");
    setCharge("");
    setStartCoord(null);

    if (map.current && map.current.getSource("landmarks")) {
      map.current.getSource("landmarks").setData({
        type: "FeatureCollection",
        features: [],
      });
    }

    if (map.current && map.current.getSource("route")) {
      map.current.removeLayer("route-line");
      map.current.removeSource("route");
    }
  };

  const allTags = [
    "Modern landmarks", "Museums", "Art galleries", "Historical landmarks",
    "Park and gardens", "Musical and theatre", "Shopping districts",
    "Royal family and palaces", "Church spirtual"
  ]
  const allSeasons = ["spring", "summer", "autumn", "winter"]

  const toggle = (val, list, setList) => {
    setList(list.includes(val) ? list.filter(v => v !== val) : [...list, val])
  }

  
useEffect(() => {
  if (map.current) return;

  map.current = new mapboxgl.Map({
    container: mapContainer.current,
    style: "mapbox://styles/mapbox/streets-v11",
    center: [-0.12, 51.5],
    zoom: 11,
  });

  let popup;
  let startMarker = null;

  // 设置点击地图选择起点
  map.current.on("click", (e) => {
    const { lng, lat } = e.lngLat;
    const coord = [lng, lat];
    setStartCoord(coord); 

    if (startMarker) startMarker.remove();

    startMarker = new mapboxgl.Marker({ color: "red" })
      .setLngLat(coord) 
      .addTo(map.current);

    console.log("Start point set:", coord);
  });

  map.current.on("load", () => {
    map.current.addSource("landmarks", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    map.current.addLayer({
      id: "landmark-points",
      type: "circle",
      source: "landmarks",
      paint: {
        "circle-radius": 6,
        "circle-color": "#e63946",
        "circle-stroke-width": 1,
        "circle-stroke-color": "#fff",
      },
    });

    map.current.on("mouseenter", "landmark-points", (e) => {
      map.current.getCanvas().style.cursor = "pointer";
      const props = e.features[0].properties;
      const coords = e.features[0].geometry.coordinates;
      const html = `
        <strong>${props.name}</strong><br/>
        Type: ${props.type}<br/>
        Tags: ${props.Tags}<br/>
        Season: ${props.BestSeason}<br/>
        Popular: ${props.Popular}<br/>
        Charge: ${props.Charge}
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
  });
}, []);

const handleFilter = async () => {
  const res = await fetch("/label_points.geojson");
  const geojson = await res.json();

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
        charge === "both" ||
        (charge === "yes" && p.Charge.toLowerCase() === "yes") ||
        (charge === "no" && p.Charge.toLowerCase() === "no");

      return tagMatch && seasonMatch && popularMatch && chargeMatch;
    }),
  };

  // 如果没有结果
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
            background-color: #e63946;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">🔄 Start Over</button>
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

  map.current.getSource("landmarks").setData(filtered);

  buildOptimizedRoute(filtered.features);

};

// 生成路径的函数
const buildOptimizedRoute = async (features) => {
  if (!startCoord) {
    alert("Please click on the map to select a start point first.");
    return;
  }

  const maxDistance = 2000; // 2000 米步行距离上限

  // 距离计算函数（单位：米）
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

  // 先检查是否有任何点在 2000m 内
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
            background-color: #e63946;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">🔄 Start Over</button>
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

  // 点扩展策略：每次加上离“当前点”最近，且 ≤ 2000m 的点
  const selected = [];
  const visited = new Set();
  let currentCoord = startCoord;

  while (selected.length < 10) {
    // 从剩余点中找最近且没被访问过的点
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

    if (!next) break; // 再也找不到了

    selected.push(next);
    visited.add(next.geometry.coordinates.join(","));
    currentCoord = next.geometry.coordinates;
  }

  // 最终点集 = 起点 + 选出的点
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

    const routeGeojson = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: data.trips[0].geometry,
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
          "line-color": "#3b9ddd",
          "line-width": 5,
          "line-opacity": 0.8
        }
      });
    } else {
      map.current.getSource("route").setData(routeGeojson);
    }

    console.log("✅ Final walk path:", coords);


    // 渲染右侧路线详情
const detailsEl = document.getElementById("route-details");
const trip = data.trips[0];
const legs = trip.legs || [];

const totalDistance = (trip.distance / 1000).toFixed(2);
const totalDuration = Math.round(trip.duration / 60);

let html = `<strong>🚶 Total: ${totalDistance} km · ${totalDuration} min</strong><hr/>`;

legs.forEach((leg, idx) => {
  const dist = (leg.distance / 1000).toFixed(2);
  const time = Math.round(leg.duration / 60);
  html += `
    <div><strong>Leg ${idx + 1}</strong> — ${dist} km · ${time} min</div>
    <ul style="margin: 0 0 10px 15px;">
      ${leg.steps.map(step => `<li>${step.maneuver.instruction} (${(step.distance/1000).toFixed(2)} km)</li>`).join("")}
    </ul>
  `;
});
detailsEl.innerHTML = html;



  } catch (error) {
    console.log("🧭 Sending Optimization API request");
console.log("Start Coord:", startCoord);
console.log("Features:", features);
console.log("All coords:", [startCoord, ...features.map(f => f.geometry.coordinates)]);
console.log("Coord string:", coordString);
console.log("URL:", url);
console.error("❌ Optimization error:", err);

  }
};



return (
  <>
    {/* 主体布局区域 */}
    <div style={{ display: "flex", height: "100vh", position: "relative" }}>
      
      {/* 左侧筛选区域 */}
      <div style={{ width: "20%", padding: "1rem", overflowY: "auto", borderRight: "1px solid #ccc" }}>
        <h3>🧭 What kind of places do you love most?</h3>
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

        <h3>🌤️ Which season do you plan to visit London?</h3>
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

        <h3>🌟 Do you prefer famous places or hidden gems?</h3>
        {[
          { label: "Hidden gems", value: "1" },
          { label: "Moderately Known", value: "2" },
          { label: "Famous", value: "3" },
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

        <h3>💸 Are you okay with ticketed (paid) attractions?</h3>
        {["yes", "no", "both"].map(opt => (
          <label key={opt} style={{ display: "block" }}>
            <input
              type="radio"
              name="charge"
              value={opt}
              checked={charge === opt}
              onChange={() => setCharge(opt)}
            />
            {" " + (opt === "yes" ? "Yes" : opt === "no" ? "No" : "No Preference")}
          </label>
        ))}

        <br />

        {/* 按钮区 */}
        <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
          <button onClick={handleFilter} style={{ padding: "10px", flex: 1 }}>
            Apply Filters
          </button>
          <button onClick={resetAll} style={{ padding: "10px", flex: 1 }}>
            Reset
          </button>
        </div>
      </div>

      {/* 地图容器 */}
      <div
        ref={mapContainer}
        style={{ width: "80%", height: "100%", position: "relative", zIndex: 0 }}
      ></div>

      {/* 左上角按钮：使用当前位置 */}
      <button
        onClick={useCurrentLocation}
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          zIndex: 10,
          padding: "8px 12px",
          background: "#3b9ddd",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer"
        }}
      >
        📍 Use My Location
      </button>
    </div>

    {/* 右上角：路线详情面板 */}
    <div
      id="route-details"
      style={{
        position: "absolute",
        top: "10px",
        right: "10px",
        width: "280px",
        maxHeight: "80vh",
        overflowY: "auto",
        background: "rgba(255,255,255,0.95)",
        borderRadius: "8px",
        padding: "10px",
        fontSize: "13px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
        zIndex: 10,
      }}
    ></div>
  </>
)
}

export default App
