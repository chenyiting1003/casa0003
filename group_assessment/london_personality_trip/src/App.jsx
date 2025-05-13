import React, { useState, useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./App.css";
import RouteDetailsAccordion from "./components/RouteDetailsAccordion.jsx";
import './components/RouteDetailsAccordion.css';
import { useNavigate } from "react-router-dom";



mapboxgl.accessToken = "pk.eyJ1IjoidWNmbmhiZyIsImEiOiJjbTZnZnV5cjEwMHZyMmxzYm50NDFpZnZtIn0.avm3fmwvzK3wOTLbezZjBQ"

function App() {
  const mapContainer = useRef(null);  // 地图 DOM 容器
  const map = useRef(null);           // Mapbox 实例
  const startMarker = useRef(null);

  const [tags, setTags] = useState([]);      // 用户选中的兴趣标签
  const [seasons, setSeasons] = useState([]); // 用户选中的季节
  const [popular, setPopular] = useState(""); // 用户选中的知名度
  const [charge, setCharge] = useState("both"); // 用户是否愿意付费景点
  const [startCoord, setStartCoord] = useState(null); // 当前起点坐标

  const [routeTrip, setRouteTrip] = useState(null);
  const [selectedFeatures, setSelectedFeatures] = useState([]);

  const navigate = useNavigate();


  
// ✅ 判断坐标是否合法
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


// ✅ 设置地图起点 + Marker
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


  
  // 设置地图点击事件：点击地图选取起点
  const setupMapClickToSetStartPoint = () => {
    map.current.on("click", (e) => {
      const coord = [e.lngLat.lng, e.lngLat.lat];
      setStartPoint(coord);
    });
  };



  // 设置 landmarks 图层与鼠标悬浮弹窗
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



// 初始化地图并绑定所有事件
const initializeMap = () => {
  map.current = new mapboxgl.Map({
    container: mapContainer.current,
    style: "mapbox://styles/ucfnhbg/cmamm5hrq00du01s50qgg2zdx/draft",
    center: [-0.12, 51.5],
    zoom: 11,
  });

  map.current.on("load", () => {
  setupLandmarkLayer();

});



  setupMapClickToSetStartPoint();
};

// 初始化地图，只运行一次
useEffect(() => {
  if (map.current) return;
  initializeMap();
}, []);



const resetAll = () => {
  navigate(0);  // ✅ 局部刷新当前页面，保留缓存、快速回到初始状态
};



//const resetAll = () => {
  //window.location.reload();  // ✅ 一键重启整个页面，恢复一切初始状态
//};



    // 清除地图上的兴趣点图层和路径图层
//const resetAll = () => {
  //setTags([]);
  //setSeasons([]);
  //setPopular("");
  //setCharge("");
  //setStartCoord(null);

  //if (startMarker.current) {
    //startMarker.current.remove();
    //startMarker.current = null;
  //}

  //if (map.current?.getSource("landmarks")) {
    //map.current.getSource("landmarks").setData({
      //type: "FeatureCollection",
      //features: [],
    //});
  //}

  //if (map.current?.getSource("route")) {
    //map.current.removeLayer("route-line");
    //map.current.removeSource("route");
  //}

  // ✅ 清空右上角路线详情内容
  //document.getElementById("route-details").innerHTML = "";
//};



//筛选逻辑
const handleFilter = async () => {
  const res = await fetch("/label_points.geojson");
  const geojson = await res.json();

  if (!isValidCoord(startCoord)) {
  alert("Please reselect a starting point on the map before applying filters.");
  return;
}

  // 根据 tag、season、popular、charge 筛选
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

  // 把结果加载到地图上
  map.current.getSource("landmarks").setData(filtered);

  // 调用路径规划
  buildOptimizedRoute(filtered.features);

};

// 生成路径的函数
const buildOptimizedRoute = async (features) => {
  if (!isValidCoord(startCoord)) {
    alert("Please click on the map to select a valid start point first.");
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

      // ✅ 在这里保存数据到 React 状态
    const trip = data.trips[0];
    setRouteTrip(trip);
    setSelectedFeatures([...selected]); // 保存用于 UI 展示的景点顺序


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

    console.log("✅ Final walk path:", coords);




  } catch (error) {

    console.log("Sending Optimization API request");
    console.log("✅ trip", trip);
console.log("✅ selected", selected);

console.log("Start Coord:", startCoord);
console.log("Features:", features);
console.log("All coords:", [startCoord, ...features.map(f => f.geometry.coordinates)]);
console.log("Coord string:", coordString);
console.log("URL:", url);
console.error("❌ Optimization error:", error);

  }
};



return (
  <>
    {/* 主体区域：左侧+地图+按钮（都要在同一个 div 内） */}
    <div style={{ display: "flex", height: "100vh", position: "relative" }}>
      
      {/* 左侧筛选气泡 */}
      <div style={{
        width: "30%",
        padding: "1rem",
        overflowY: "auto",
        borderRight: "1px solid #ccc",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>

        {/* 页面标题 */}
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

{/* 起点提示 + 使用当前位置 */}
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



  {/* 标签筛选 */}
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

  {/* 季节筛选 */}
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

  {/* 知名度 */}
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

  {/* 是否付费 */}
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

  {/* 按钮区 */}
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


        {/* 地图容器 */}
        <div
          ref={mapContainer}
          style={{ width: "70%", height: "100%", position: "relative", zIndex: 0 }}
        ></div>

      </div>

      {/* 右上角：路线详情面板 */}
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
    </>
  );
}

export default App
