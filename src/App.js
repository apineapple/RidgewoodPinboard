import React, { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import cork from './images/cork.png';
import wood from './images/wood.png';
import flyerflyer from './images/flyerflyer.png';
import imageurls from "./imageurls.json";


const INITIAL_TILE_SIZE = 400;
const ZOOM_LEVELS = [10,20,25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300];
const PIN_WIDTH = 120;
const PIN_HEIGHT = Math.round(PIN_WIDTH * (150 / 120));

const formatDate = (date) => String(date.getMonth() + 1).padStart(2, '0') + `/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;

const dateFromToday = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return formatDate(date);
};


const randomRotation = () => {
  const magnitude = Math.random() < 0.75 ? 1 + Math.floor(Math.random() * 5) : 6 + Math.floor(Math.random() * 10);
  return (Math.random() < 0.5 ? -1 : 1) * magnitude;
};


const EXPIRATION_DAYS = [20, 16, 12, 7, 3];
const IMAGE_DATA = [
  {src: flyerflyer, expirationDate: dateFromToday(20)},
  ...Array.from({ length: imageurls.length }, (_, i) => ({
    src: imageurls[i % imageurls.length],
    expirationDate: dateFromToday(EXPIRATION_DAYS[i % EXPIRATION_DAYS.length])
  })),
];

const expirationTime = (expirationDate) => {
  const [month, day, year] = expirationDate.split('/').map(Number);
  return new Date(year, month - 1, day).getTime();
};

const sortByExpirationNewestFirst = (images) => [...images].sort(
  (a, b) => expirationTime(b.expirationDate) - expirationTime(a.expirationDate),
);


const placeImages = (images) => {

  const boardImages = sortByExpirationNewestFirst(images.filter((image) => (image.index ?? 0) > 0));
  const generatePositions = (n) => {
    if (n <= 0) return [];
    const positions = [];

    const cx = 0.5 * PIN_WIDTH *  (Math.random() * (1.2 - .9) + .9);;
    const cy = 0.5 * PIN_HEIGHT * (Math.random() * (1.1 - .8) + .8);;
    const center = [
      { x: -cx, y: -cy },
      { x: cx, y: -cy }, 
      { x: cx, y: cy }, 
      { x: -cx, y: cy },
    ];
    for (let i = 0; i < Math.min(n, center.length); i += 1) positions.push(center[i]);
    if (positions.length >= n) return positions.slice(0, n);

    let ring = 1;
    while (positions.length < n) {
      const r = ring + 0.5; 

      for (let col = -r; col <= r && positions.length < n; col += 1) {
        positions.push({ x: col * PIN_WIDTH*1.07, y: -r * PIN_HEIGHT*1.07 });
      }

      for (let row = -r + 1; row <= r && positions.length < n; row += 1) {
        positions.push({ x: r * PIN_WIDTH*1.07, y: row * PIN_HEIGHT*1.07 });
      }
      for (let col = r - 1; col >= -r && positions.length < n; col -= 1) {
        positions.push({ x: col * PIN_WIDTH*1.07, y: r * PIN_HEIGHT*1.07 });
      }

      for (let row = r - 1; row >= -r + 1 && positions.length < n; row -= 1) {
        positions.push({ x: -r * PIN_WIDTH*1.07, y: row * PIN_HEIGHT*1.07 });
      }

      ring += 1;
    }
    return positions.slice(0, n);
  };

  const base = generatePositions(boardImages.length);
  const prepared = boardImages.map((image, idx) => {
    return {
      ...image,
      rotation: image.rotation ?? randomRotation(),
      x: base[idx]?.x,
      y: base[idx].y,
      zIndex: Math.floor(Math.random() * 2),
    };
  });

  const placedByIndex = new Map(prepared.map((image) => [image.index, image]));
  return images.map((image) => placedByIndex.get(image.index) ?? image);
};

function App() {
  return (
    <div className="App">
      <title>Ridgewood Pinboard</title>
            <Board />
    </div>
  );
}

function Board() {
  const scrollRef = useRef(null);
  const centerRef = useRef({ left: 0, top: 0 });
  const [, setCoords] = useState({ x: 0, y: 0 });
  const [tileSize, setTileSize] = useState(INITIAL_TILE_SIZE);
  const tileSizeRef = useRef(INITIAL_TILE_SIZE);
  const [images] = useState(() => placeImages(
    IMAGE_DATA.map((image, index) => ({
      ...image,
      index,
    })),
    true,
  ));
  const firstPoster = IMAGE_DATA[0];
  const FIRST_POSTER_KEY = 0;
  const fileInputRef = useRef(null);
  const pinchRef = useRef({ active: false, startDistance: 0, startTileSize: INITIAL_TILE_SIZE });
  const [hoveredId, setHoveredId] = useState(null);
  const [modalImage, setModalImage] = useState(null);
  const [pendingUpload, setPendingUpload] = useState(null);
  const positionedImages = sortByExpirationNewestFirst(images.filter((image) => (image.index ?? 0) > 0));
  const isFirstPosterModal = modalImage === firstPoster;

  const getViewportPosition = useCallback((el, scale = tileSizeRef.current / INITIAL_TILE_SIZE) => ({
    x: (el.scrollLeft + el.clientWidth / 2 - centerRef.current.left) / scale,
    y: (el.scrollTop + el.clientHeight / 2 - centerRef.current.top) / scale,
  }), []);

  const handleFileSelection = useCallback((event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const isImage = /^image\/(png|jpeg)$/i.test(file.type) || /\.(png|jpe?g)$/i.test(file.name);
    if (!isImage) {
      event.target.value = '';
      return;
    }

    setPendingUpload({ file, fileName: file.name });
    event.target.value = '';
  }, []);

  const handleUploadConfirm = useCallback(async () => {
    if (!pendingUpload) return;

    try {
      const response = await fetch('http://localhost:3001/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: pendingUpload.fileName,
          recipient: 'obiwonton123@gmail.com',
          action: 'upload-confirmed',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Upload failed', error);
    } finally {
      setPendingUpload(null);
    }
  }, [pendingUpload]);

  const getViewportCoords = useCallback((el) => {
    const { x, y } = getViewportPosition(el);
    return { x: Math.round(x), y: Math.round(y) };
  }, [getViewportPosition]);

  const applyZoom = useCallback((nextTileSize) => {
    const el = scrollRef.current;
    if (!el) return;

    const currentScale = tileSizeRef.current / INITIAL_TILE_SIZE;
    const nextScale = nextTileSize / INITIAL_TILE_SIZE;

    const viewportCenterX = el.scrollLeft + el.clientWidth / 2;
    const viewportCenterY = el.scrollTop + el.clientHeight / 2;

    const boardX = (viewportCenterX - centerRef.current.left) / currentScale;
    const boardY = (viewportCenterY - centerRef.current.top) / currentScale;

    tileSizeRef.current = nextTileSize;
    el.scrollLeft = centerRef.current.left + boardX * nextScale - el.clientWidth / 2;
    el.scrollTop = centerRef.current.top + boardY * nextScale - el.clientHeight / 2;
    setTileSize(nextTileSize);
  }, []);

  const getAdjacentTileSize = useCallback((direction) => {
    const currentPercentage = Math.round((tileSizeRef.current / INITIAL_TILE_SIZE) * 100);
    const currentIndex = ZOOM_LEVELS.indexOf(currentPercentage);
    const nextIndex = currentIndex === -1
      ? direction > 0
        ? 0
        : ZOOM_LEVELS.length - 1
      : Math.min(
          ZOOM_LEVELS.length - 1,
          Math.max(0, currentIndex + direction)
        );
    const nextPercentage = ZOOM_LEVELS[nextIndex] ?? currentPercentage;
    return (nextPercentage * INITIAL_TILE_SIZE) / 100;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
    centerRef.current.left = el.scrollLeft + el.clientWidth / 2;
    centerRef.current.top = el.scrollTop + el.clientHeight / 2;
    setCoords({ x: 0, y: 0 });

    const getTouchDistance = (touchA, touchB) => Math.hypot(
      touchA.clientX - touchB.clientX,
      touchA.clientY - touchB.clientY,
    );

    const drag = {
      active: false,
      startX: 0,
      startY: 0,
      startLeft: 0,
      startTop: 0,
    };

    const onMouseDown = (ev) => {
      if (modalImage) return;
      drag.active = true;
      drag.startX = ev.clientX;
      drag.startY = ev.clientY;
      drag.startLeft = el.scrollLeft;
      drag.startTop = el.scrollTop;
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    };

    const onMouseMove = (ev) => {
      if (!drag.active || modalImage) return;
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      el.scrollLeft = drag.startLeft - dx;
      el.scrollTop = drag.startTop - dy;
      setCoords(getViewportCoords(el));
    };

    const endDrag = () => {
      drag.active = false;
      el.style.cursor = '';
      el.style.userSelect = '';
    };

    const onTouchStart = (ev) => {
      if (modalImage) return;

      if (ev.touches.length === 2) {
        pinchRef.current.active = true;
        pinchRef.current.startDistance = getTouchDistance(ev.touches[0], ev.touches[1]);
        pinchRef.current.startTileSize = tileSizeRef.current;
        drag.active = false;
        return;
      }

      const t = ev.touches[0];
      drag.active = true;
      drag.startX = t.clientX;
      drag.startY = t.clientY;
      drag.startLeft = el.scrollLeft;
      drag.startTop = el.scrollTop;
    };
    const onTouchMove = (ev) => {
      if (modalImage) return;

      if (ev.touches.length === 2 && pinchRef.current.active) {
        ev.preventDefault();
        const currentDistance = getTouchDistance(ev.touches[0], ev.touches[1]);
        const scaleRatio = currentDistance / pinchRef.current.startDistance;
        const nextTileSize = Math.min(Math.max(
          pinchRef.current.startTileSize * scaleRatio,
          (ZOOM_LEVELS[0] * INITIAL_TILE_SIZE) / 100),
          (ZOOM_LEVELS[ZOOM_LEVELS.length - 1] * INITIAL_TILE_SIZE) / 100);

        if (Math.abs(nextTileSize - tileSizeRef.current) > 0.5) {
          applyZoom(nextTileSize);
        }
        return;
      }

      if (!drag.active) return;
      const t = ev.touches[0];
      const dx = t.clientX - drag.startX;
      const dy = t.clientY - drag.startY;
      el.scrollLeft = drag.startLeft - dx;
      el.scrollTop = drag.startTop - dy;
      setCoords(getViewportCoords(el));
      ev.preventDefault();
    };

    const onTouchEnd = () => {
      pinchRef.current.active = false;
      drag.active = false;
      el.style.cursor = '';
      el.style.userSelect = '';
    };

    const onScroll = () => {
      setCoords(getViewportCoords(el));
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', endDrag);
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    el.addEventListener('scroll', onScroll);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', endDrag);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('scroll', onScroll);
    };
  }, [applyZoom, getViewportCoords, modalImage]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        applyZoom(getAdjacentTileSize(1));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        applyZoom(getAdjacentTileSize(-1));
      }
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyZoom, getAdjacentTileSize]);

  useEffect(() => {
    const handleResize = () => {
      const el = scrollRef.current;
      if (!el) return;

      const centerX = centerRef.current.left;
      const centerY = centerRef.current.top;
      el.scrollLeft = centerX - el.clientWidth / 2;
      el.scrollTop = centerY - el.clientHeight / 2;
      centerRef.current.left = el.scrollLeft + el.clientWidth / 2;
      centerRef.current.top = el.scrollTop + el.clientHeight / 2;
      setCoords(getViewportCoords(el));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getViewportCoords]);

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minHeight: '100vh' }}>
      <div
        style={{
          position: 'absolute',
          left: '40px',
          top: '5vh',
          width: '120px',
          height: '150px',
          zIndex: 30,
          transform: 'rotate(-8deg)',
          overflow: 'visible',
          boxShadow: hoveredId === FIRST_POSTER_KEY
            ? `0 0 8px 8px rgba(226, 150, 222, 0.5)`
            : '0 8px 18px rgba(0,0,0,0.28)',
          transition: 'box-shadow 0.18s ease',
        }}
        onMouseEnter={() => setHoveredId(FIRST_POSTER_KEY)}
        onMouseLeave={() => setHoveredId(null)}
        onClick={(e) => { e.stopPropagation(); setModalImage(firstPoster); }}
      >
        <img
          key={FIRST_POSTER_KEY}
          src={firstPoster.src}
          alt="first poster"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
            display: 'block',
            cursor: 'pointer',
            imageRendering: 'auto',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            zIndex: 5,
          }}
        />
      </div>
      <div
        className="board-shell"
        style={{
          position: 'relative',
          zIndex: 1,
          border: 'double 20px transparent',
          borderRadius: '2px',
          backgroundImage: `linear-gradient(rgba(222, 24, 229, 0.7), rgba(222, 24, 229, 0.7)), url(${wood})`,
          backgroundRepeat: 'nrepeat, repeat',
          backgroundSize: '100px 100px',
          backgroundOrigin: 'border-box',
          backgroundClip: 'content-box, border-box',
          marginTop: '-5vh',
          height: '70vh',
          width: '60vw',
          marginLeft: '20vw',
          overflow: 'hidden',
          boxShadow: '2px 10px 10px rgba(0,0,0,.5)',
        }}
      >
      <div
        ref={scrollRef}
        className="scroll-area board-scroll-area"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'auto',
          position: 'relative',
          zIndex: 1,
        }}
      >        <div
          style={{
            width: '20000px',
            height: '20000px',
            backgroundImage: `linear-gradient(rgba(114, 17, 211, 0.4), rgba(222, 24, 229, 0.4)), url(${cork})`,
            backgroundRepeat: 'no-repeat, repeat',
            backgroundSize: `auto, ${tileSize}px ${tileSize}px`,
            backgroundBlendMode: 'multiply',
            position: 'relative',
            borderRadius: '2px',
            boxShadow: '2px 10px 10px rgba(0,0,0,.5)',
            zIndex: 0,
          }}
        >
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',             zIndex:0,}}>
          </div>
        </div>

        
          
        {positionedImages.map((img, index) => {
          const scale = tileSize / INITIAL_TILE_SIZE;
          const displayW = PIN_WIDTH * scale;
          const displayH = PIN_HEIGHT * scale;
          const leftRender = centerRef.current.left + img.x * scale - displayW / 2;
          const topRender = centerRef.current.top + img.y * scale - displayH / 2;
          const imageKey = img.index ?? index;
          return (
            <img key={`img-${imageKey}`} src={img.src} alt="error"
              onMouseEnter={() => setHoveredId(imageKey)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={(e) => { e.stopPropagation(); setModalImage(img); }}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                left: leftRender,
                top: topRender,
                width: displayW,
                height: displayH,
                objectFit: 'cover',
                objectPosition: 'center center',
                transform: `rotate(${img.rotation}deg)`,
                transformOrigin: 'center center',
                zIndex: (img.zIndex ?? 0) + 10,
                pointerEvents: 'auto',
                imageRendering: 'auto',
                backfaceVisibility: 'hidden',
                boxShadow: hoveredId === imageKey ? `0 0 8px 8px rgba(226, 150, 222, 0.5)` : 'rgba(0,0,0,.2) 0px 8px 10px',
              }} />
          );
        })}
        </div>
      
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
        style={{ display: 'none' }}
        onChange={handleFileSelection}
      />
      {pendingUpload && (
        <div className="image-modal-overlay" onClick={() => setPendingUpload(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px', textAlign: 'center',zIndex: '10000' }}>
            <h3 style={{ marginTop: 0, marginBottom: '18px', color: '#2b2b2b' }}>Upload "{pendingUpload.fileName}"?</h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button type="button" onClick={() => setPendingUpload(null)} style={{ padding: '10px 18px', borderRadius: '999px', border: '1px solid #d0d0d0', background: '#fff', cursor: 'pointer' }}>No</button>
              <button type="button" onClick={handleUploadConfirm} style={{ padding: '10px 18px', borderRadius: '999px', border: 'none', background: '#7b61ff', color: '#fff', cursor: 'pointer' }}>Yes</button>
            </div>
          </div>
        </div>
      )}
      {modalImage && (
        <div className="image-modal-overlay" onClick={() => setModalImage(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <img
              src={modalImage.src}
              alt="error"
              style={{
                objectFit: 'contain',
                objectPosition: 'center center',
                imageRendering: 'auto',
                maxWidth: '100%',
                maxHeight: '75vh',
                display: 'block',
              }}
            />
            {isFirstPosterModal && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '44%',
                  transform: 'translate(-50%, -50%)',
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  textAlign: 'center',
                  color: 'transparent',
                  display: 'inline-block',
                  padding: '9px 16px',
                  borderRadius: '100px',
                  border: 'none',
                  zIndex: 0,
                  backgroundImage: 'linear-gradient(-180deg, #799FD4 0%, #748695 100%)',
                  boxShadow: '0 5px 2px -3px rgba(14,97,192,0.19), 0 1px 1px 0 rgba(14,97,192,0.19), 0 3px 9px 0 rgba(0,128,161,0.33)',
                  cursor: 'pointer',
                  overflow: 'visible',
                }}
              >
                <span
                  style={{
                    color: '#f3f3f3',
                    textShadow: '0 1px 0 rgba(185,224,253,0.4)',
                    position: 'relative',
                    zIndex: 3,
                    display: 'block',
                    top: '-1px',
                  }}
                >
                  Click to Add Your Flyer!
                </span>
                <span
                  style={{
                    content: '" "',
                    display: 'block',
                    backgroundImage: 'linear-gradient(-180deg, #ABC9EC 0%, #76A9D7 100%)',
                    position: 'absolute',
                    top: '1px',
                    left: '8px',
                    right: '8px',
                    bottom: '50%',
                    zIndex: 2,
                    borderRadius: '100px',
                    pointerEvents: 'none',
                  }}
                />
                <span
                  style={{
                    content: '" "',
                    display: 'block',
                    position: 'absolute',
                    zIndex: -1,
                    top: '1px',
                    left: '1px',
                    right: '1px',
                    bottom: '1px',
                    borderRadius: '100px',
                    backgroundImage: 'linear-gradient(-180deg, #689DD3 50%, #BAE3F6 100%)',
                    boxShadow: 'inset 0 0 1px rgba(42,128,226,0.5), inset 0 0 12px 2px rgba(255,255,255,0.21)',
                    pointerEvents: 'none',
                  }}
                />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
