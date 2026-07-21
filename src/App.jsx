import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";
import {
  personalCoordinates as coordinates,
  personalStops as stops,
  recurringPlaces as appendix,
} from "./journeyData";

const key =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  import.meta.env.GOOGLE_MAPS_API_KEY;
let gp;
function loadPlaces() {
  if (!key) return Promise.reject();
  if (window.google?.maps?.places) return Promise.resolve();
  if (gp) return gp;
  gp = new Promise((ok, no) => {
    const cb = `journeyPlaces${Date.now()}`;
    window[cb] = () => {
      ok();
      delete window[cb];
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&loading=async&v=weekly&callback=${cb}`;
    s.async = true;
    s.onerror = no;
    document.head.appendChild(s);
  });
  return gp;
}
function Compass() {
  return (
    <svg viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="21" />
      <path d="m29 19-8 2-2 8 8-2 2-8Z" />
      <path d="M24 3v5M24 40v5M3 24h5M40 24h5" />
    </svg>
  );
}
function Arrow() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M5 12h14M14 6l6 6-6 6" />
    </svg>
  );
}
function Photos({ stop, cache, setCache, onOpen, limit = 3 }) {
  const r = cache[stop.id];
  useEffect(() => {
    if (r || !key) return;
    let live = true;
    loadPlaces()
      .then(async () => {
        const { Place } = await window.google.maps.importLibrary("places");
        const { places } = await Place.searchByText({
          textQuery: stop.query,
          fields: ["displayName", "formattedAddress", "photos"],
          maxResultCount: 1,
          language: "en",
        });
        if (!live) return;
        const place = places?.[0];
        if (!place) {
          setCache((c) => ({ ...c, [stop.id]: { status: "error" } }));
          return;
        }
        const photos = (place.photos || []).slice(0, limit).map((photo) => ({
          src: photo.getURI({ maxWidth: 2400, maxHeight: 1600 }),
          attributions: (photo.authorAttributions || [])
            .filter((author) => author.displayName)
            .map((author) => ({
              name: author.displayName,
              uri: author.uri,
            })),
        }));
        setCache((c) => ({
          ...c,
          [stop.id]: {
            status: "ready",
            photos,
            name: place.displayName,
          },
        }));
      })
      .catch(
        () =>
          live && setCache((c) => ({ ...c, [stop.id]: { status: "error" } })),
      );
    return () => {
      live = false;
    };
  }, [stop, r, setCache, limit]);
  if (!key)
    return (
      <div className="photo-empty">
        <span>PLACE PHOTOGRAPHY</span>
        <strong>{stop.modern}</strong>
        <small>
          Add VITE_GOOGLE_MAPS_API_KEY to load high-resolution Places imagery.
        </small>
      </div>
    );
  if (!r || r.status === "loading")
    return (
      <div className="photo-skeleton">
        <i />
        <i />
        <i />
      </div>
    );
  if (r.status === "error" || !r.photos?.length)
    return (
      <div className="photo-empty">
        <span>NO PHOTOS RETURNED</span>
        <strong>{stop.modern}</strong>
      </div>
    );
  return (
    <div className="photo-grid">
      {r.photos.map((p, i) => (
        <figure className={i === 0 ? "hero-photo" : ""} key={p.src}>
          <button
            className="photo-open"
            type="button"
            aria-label={`View ${r.name || stop.place} photo in full screen`}
            onClick={() =>
              onOpen?.({
                ...p,
                alt: `${r.name || stop.place} from Google Places`,
                place: r.name || stop.place,
              })
            }
          >
            <img
              src={p.src}
              alt={`${r.name || stop.place} from Google Places`}
            />
            <span className="photo-zoom" aria-hidden="true">
              Expand
            </span>
          </button>
        </figure>
      ))}
    </div>
  );
}
function Lightbox({ photo, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${photo.place} high-resolution photograph`}
      onClick={onClose}
    >
      <button className="lightbox-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <figure className="lightbox-frame" onClick={(event) => event.stopPropagation()}>
        <img src={photo.src} alt={photo.alt} />
        <figcaption>
          <strong>{photo.place}</strong>
          {!!photo.attributions?.length && (
            <span className="photo-attribution">
              Photo source:{" "}
              {photo.attributions.map((author, index) => (
                <span key={`${author.name}-${index}`}>
                  {index > 0 && ", "}
                  {author.uri ? (
                    <a href={author.uri} target="_blank" rel="noreferrer">
                      {author.name}
                    </a>
                  ) : (
                    author.name
                  )}
                </span>
              ))}
            </span>
          )}
        </figcaption>
      </figure>
    </div>
  );
}
function Panel({ stop, onClose, onNext, cache, setCache, onPhotoOpen }) {
  return (
    <aside className="detail-panel">
      <div className="panel-grab" />
      <button className="panel-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <Photos
        stop={stop}
        cache={cache}
        setCache={setCache}
        onOpen={onPhotoOpen}
      />
      <div className="panel-body">
        <div className="panel-kicker">
          <span>STOP {stop.n}</span>
          <i>{stop.confidence}</i>
        </div>
        <h2>{stop.place}</h2>
        <p className="myth-name">{stop.myth}</p>
        <div className="place-meta">
          <span>
            <b>PLACE</b>
            {stop.modern}
          </span>
          <span>
            <b>IN THE JOURNEY</b>
            {stop.book}
          </span>
        </div>
        <p className="place-story">{stop.text}</p>
        <button className="next-stop" onClick={onNext}>
          Continue the journey <Arrow />
        </button>
        <p className="photo-source">
          Photography is requested live from Google Places.
        </p>
      </div>
    </aside>
  );
}
function Map({ active, setActive }) {
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const routeLayerRef = useRef(null);

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;
    const map = L.map(elementRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      minZoom: 1,
      maxZoom: 13,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      noWrap: true,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.on("zoomend", () => {
      if (map.getZoom() === map.getMinZoom()) {
        map.panTo([20, -5], { animate: false });
      }
    });
    if (window.matchMedia("(max-width: 900px)").matches) {
      map.setView(coordinates["san-francisco-1"], 5);
    } else {
      map.fitBounds(L.latLngBounds(Object.values(coordinates)), {
        padding: [34, 34],
      });
    }
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeLayerRef.current?.remove();
    const group = L.layerGroup().addTo(map);
    const route = stops.map((stop) => coordinates[stop.id]);
    L.polyline(route, {
      color: "white",
      weight: 7,
      opacity: 0.86,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(group);
    L.polyline(route, {
      color: "#b75535",
      weight: 3,
      opacity: 0.96,
      dashArray: "9 8",
      lineCap: "round",
      lineJoin: "round",
    }).addTo(group);
    stops.forEach((stop, index) => {
      const selected = active?.id === stop.id;
      const matchingStops = stops.filter((item) => item.place === stop.place);
      const visitIndex = matchingStops.findIndex((item) => item.id === stop.id);
      const markerShift =
        matchingStops.length > 1
          ? (visitIndex - (matchingStops.length - 1) / 2) * 24
          : 0;
      const markerSize = selected ? 42 : 34;
      const markerAnchor = markerSize / 2;
      const icon = L.divIcon({
        className: "odyssey-marker-wrap",
        html: `<span class="odyssey-marker${selected ? " is-active" : ""}" aria-hidden="true">${index + 1}</span>`,
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerAnchor - markerShift, markerAnchor],
      });
      L.marker(coordinates[stop.id], {
        icon,
        title: `${index + 1}. ${stop.place} - ${stop.myth}`,
        keyboard: true,
      })
        .bindTooltip(`${index + 1}. ${stop.place}`, {
          direction: "top",
          offset: [0, -18],
          className: "odyssey-tooltip",
        })
        .on("click", () => setActive(stop))
        .addTo(group);
    });
    routeLayerRef.current = group;
    const invalidateTimer = window.setTimeout(() => map.invalidateSize(), 260);
    if (active) {
      const minimumStopZoom = window.matchMedia("(max-width: 900px)").matches
        ? 8
        : 7;
      map.flyTo(
        coordinates[active.id],
        Math.max(map.getZoom(), minimumStopZoom),
        {
          duration: 0.9,
        },
      );
    }
    return () => {
      window.clearTimeout(invalidateTimer);
      group.remove();
    };
  }, [active, setActive]);

  return (
    <div className="map-shell">
      <div className="map-toolbar">
        <span>A LIFE ACROSS THE WORLD · {stops.length} STOPS</span>
        <span className="map-hint">DRAG TO EXPLORE · +/− TO ZOOM</span>
      </div>
      <div className="map-viewport">
        <div
          ref={elementRef}
          className="real-map"
          role="application"
          aria-label="Interactive world map of a personal journey"
        />
        <div className="map-legend">
          <span>
            <i />
            The route
          </span>
          <span>
            <b>{stops.length}</b> stops
          </span>
        </div>
      </div>
    </div>
  );
}
function AppendixEntry({ item, index, photos, setPhotos, onPhotoOpen }) {
  const [open, setOpen] = useState(false);

  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <div>
          <small>{item.place}</small>
          <h3>{item.myth}</h3>
        </div>
        <b>＋</b>
      </summary>
      {open && (
        <>
          <div className="appendix-photo">
            <Photos
              stop={item}
              cache={photos}
              setCache={setPhotos}
              onOpen={onPhotoOpen}
              limit={1}
            />
          </div>
          <div className="appendix-body">
            <p>{item.text}</p>
            <h4>CHAPTERS ON THE ROUTE</h4>
            <div className="alternative-list">
              {item.alternatives.map((chapter) => (
                <span key={chapter}>↳ {chapter}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </details>
  );
}
function App() {
  const [active, setActive] = useState(null),
    [photos, setPhotos] = useState({}),
    [playing, setPlaying] = useState(false),
    [lightbox, setLightbox] = useState(null);
  const timer = useRef();
  const playIndex = useRef(0);
  useEffect(() => {
    if (!playing) {
      clearInterval(timer.current);
      return;
    }
    timer.current = setInterval(() => {
      playIndex.current = (playIndex.current + 1) % stops.length;
      setActive(stops[playIndex.current]);
    }, 3200);
    return () => clearInterval(timer.current);
  }, [playing]);
  const togglePlay = () => {
    if (!playing) {
      playIndex.current = active
        ? stops.findIndex((stop) => stop.id === active.id)
        : 0;
      setActive(stops[playIndex.current]);
    }
    setPlaying((current) => !current);
  };
  const begin = () => {
    setActive(stops[0]);
    setTimeout(
      () =>
        document
          .querySelector("#journey")
          ?.scrollIntoView({ behavior: "smooth" }),
      20,
    );
  };
  const next = () =>
    setActive(
      stops[(stops.findIndex((s) => s.id === active.id) + 1) % stops.length],
    );
  return (
    <main id="top">
      <header>
        <a className="brand" href="#top">
          <Compass />
          <span>
            MY JOURNEY<small>AN INTERACTIVE LIFE</small>
          </span>
        </a>
        <nav>
          <a href="#journey">Journey</a>
          <a href="#appendix">Places of return</a>
        </nav>
        <button className="begin" onClick={begin}>
          Start the journey <Arrow />
        </button>
      </header>
      <section className="journey" id="journey">
        <div className="section-head">
          <div>
            <span className="section-no">01</span>
            <p className="eyebrow">THE LONG WAY HOME</p>
            <h2>Follow the journey</h2>
          </div>
          <div className="journey-controls">
            <button
              className={playing ? "playing" : ""}
              onClick={togglePlay}
            >
              {playing ? "■ Pause journey" : "▶ Play journey"}
            </button>
            <p>Tap on a number to learn more.</p>
          </div>
        </div>
        <div className={`experience ${active ? "has-panel" : ""}`}>
          <Map
            active={active}
            setActive={(s) => {
              setPlaying(false);
              setActive(s);
            }}
          />
          {active && (
            <Panel
              stop={active}
              onClose={() => setActive(null)}
              onNext={next}
              cache={photos}
              setCache={setPhotos}
              onPhotoOpen={setLightbox}
            />
          )}
        </div>
        <div className="route-strip">
          {stops.map((s, i) => (
            <button
              key={s.id}
              className={active?.id === s.id ? "active" : ""}
              onClick={() => {
                setPlaying(false);
                setActive(s);
              }}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <b>{s.place}</b>
              <small>{s.myth}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="appendix" id="appendix">
        <div className="section-head">
          <div>
            <span className="section-no">02</span>
            <p className="eyebrow">PLACES OF RETURN</p>
            <h2>The cities that recur</h2>
          </div>
        </div>
        <div className="appendix-grid">
          {appendix.map((item, index) => (
            <AppendixEntry
              key={item.id}
              item={item}
              index={index}
              photos={photos}
              setPhotos={setPhotos}
              onPhotoOpen={setLightbox}
            />
          ))}
        </div>
      </section>
      <footer>
        <div className="brand light">
          <Compass />
          <span>
            MY JOURNEY<small>AN INTERACTIVE LIFE</small>
          </span>
        </div>
        <a href="#top">Return to San Francisco ↑</a>
      </footer>
      {lightbox && (
        <Lightbox photo={lightbox} onClose={() => setLightbox(null)} />
      )}
    </main>
  );
}
export default App;
