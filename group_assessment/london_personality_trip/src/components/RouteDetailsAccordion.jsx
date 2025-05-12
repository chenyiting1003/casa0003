// ✅ 依赖：react-bootstrap
// 安装命令：npm install react-bootstrap bootstrap

import Accordion from "react-bootstrap/Accordion";
import Card from "react-bootstrap/Card";
import 'bootstrap/dist/css/bootstrap.min.css';
import './RouteDetailsAccordion.css';



function RouteDetailsAccordion({ trip, selected, map }) {
  if (!trip || !selected || selected.length === 0) return null;

  // 调试日志
  console.log("Trip loaded:", trip);
  console.log("Selected places:", selected.map(f => f.properties.name));
  console.log("map instance:", map);

  const totalDistance = (trip.distance / 1000).toFixed(2);
  const totalDuration = Math.round(trip.duration / 60);
  const legs = trip.legs || [];
  const names = ["Start Point", ...selected.map(f => f.properties.name)];

  // 点击跳转函数
  const flyToLegMidpoint = (leg, idx) => {
    const coords = leg.steps.flatMap(step => step.geometry?.coordinates || []);
    let mid;

    if (coords.length > 0) {
      mid = coords[Math.floor(coords.length / 2)];
    } else {
      const from = selected[idx]?.geometry.coordinates;
      const to = selected[idx + 1]?.geometry.coordinates;
      if (from && to) {
        mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
      } else {
        console.warn("No valid coords to fly to");
        return;
      }
    }


    if (mid && map && typeof map.flyTo === "function") {
      console.log("Flying to midpoint:", mid);
      map.flyTo({ center: mid, zoom: 15 });
    } else {
      console.warn("Could not fly to midpoint", mid, map);
    }
  };

  return (
    <div className="route-panel">
      <p className="route-intro">
        Walking Route Details
      </p>

      <Card className="mb-2 route-card">
        <Card.Body>
          <p className="route-total">
            Total: {totalDistance} km · {totalDuration} min
            </p>
        </Card.Body>
      </Card>

      {legs.map((leg, idx) => {
        const dist = (leg.distance / 1000).toFixed(2);
        const time = Math.round(leg.duration / 60);
        const fromName = names[idx] || `Point ${idx}`;
        const toName = names[idx + 1] || `Point ${idx + 1}`;

        return (
          <Card
            key={idx}
            className="mb-2 route-card"
            onClick={() => flyToLegMidpoint(leg, idx)}
          >
            <Card.Body className="route-card-body">
              <div style={{ display: "flex" }}>
                <div style={{ width: "60%", textAlign: "left", color: "#000009" }}>
                  <div>From {fromName}</div>
                  <div>to {toName}</div>
                </div>

                <div style={{ width: "40%", textAlign: "right", color: "#000009"}}>
                  <div>{dist} km</div>
                  <div>{time} min</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        );
      })}
    </div>
  );
}


export default RouteDetailsAccordion;
