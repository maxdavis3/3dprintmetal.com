/**
 * PrintWire 3D Model Viewer  v1.0.0
 * ─────────────────────────────────
 * CDN-only three.js viewer for Hugo static sites.
 * Supports: GLTF/GLB, STL
 *
 * Usage (called by Hugo shortcode automatically):
 *   PrintWireModelViewer.init("container-id", { src, height, autorotate, background })
 */
window.PrintWireModelViewer = (function () {
  "use strict";

  const VERSION = "0.168.0";

  /* ── Public API ─────────────────────────────────────────── */
  return {
    init: async function (id, opts) {
      opts = Object.assign(
        { src: "", height: 500, autorotate: true, background: "#1a1a2e", theme: "auto" },
        opts
      );

      const wrap = document.getElementById(id);
      if (!wrap) return console.error("[model-viewer] wrapper not found:", id);

      wrap.dataset.theme = opts.theme;
      wrap.style.setProperty("--mv-bg", opts.background);

      // Inject skeleton
      wrap.innerHTML = `
        <div class="mv-loader" id="${id}-loader">
          <div class="mv-spinner"></div>
          <div class="mv-progress-bar"><div class="mv-progress-fill" id="${id}-prog"></div></div>
          <div class="mv-loader-text">Loading model…</div>
        </div>
        <div class="mv-badge" id="${id}-badge">3D</div>
        <div class="mv-toolbar">
          <button class="mv-btn${opts.autorotate ? " active" : ""}" id="${id}-btn-rotate" title="Toggle auto-rotate">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12a8 8 0 1 0 8-8"/><polyline points="4 4 4 12 12 12"/>
            </svg>
          </button>
          <button class="mv-btn" id="${id}-btn-reset" title="Reset camera">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
          </button>
          <button class="mv-btn active" id="${id}-btn-grid" title="Toggle grid">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
          </button>
          <button class="mv-btn" id="${id}-btn-fs" title="Fullscreen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
        </div>`;

      // Insert canvas before loader
      const canvas = document.createElement("canvas");
      canvas.style.height = opts.height + "px";
      wrap.insertBefore(canvas, wrap.querySelector(".mv-loader"));

      try {
        await _boot(id, canvas, opts);
      } catch (err) {
        console.error("[model-viewer] init error:", err);
        const loaderText = document.querySelector(`#${id}-loader .mv-loader-text`);
        if (loaderText) loaderText.textContent = "⚠ Could not load model.";
      }
    },
  };

  /* ── Bootstrap: import three.js and start viewer ──────── */
  async function _boot(id, canvas, opts) {
    // Dynamic imports resolved by importmap in shortcode
    const THREE                   = await import("three");
    const { OrbitControls }       = await import("three/addons/controls/OrbitControls.js");
    const { GLTFLoader }          = await import("three/addons/loaders/GLTFLoader.js");
    const { STLLoader }           = await import("three/addons/loaders/STLLoader.js");
    const { DRACOLoader }         = await import("three/addons/loaders/DRACOLoader.js");

    const loader$ = document.getElementById(`${id}-loader`);
    const prog$   = document.getElementById(`${id}-prog`);
    const badge$  = document.getElementById(`${id}-badge`);

    /* ── Renderer ── */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    /* ── Scene & camera ── */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(opts.background);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 2000);

    /* ── Lighting ── */
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(5, 10, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x8899ff, 0.35);
    fill.position.set(-5, 3, -5);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(0, 6, -10);
    scene.add(rim);

    /* ── Grid ── */
    const isDark = _isDark(opts.background);
    const grid = new THREE.GridHelper(
      20, 20,
      isDark ? 0x444466 : 0x9999bb,
      isDark ? 0x2a2a50 : 0xbbbbdd
    );
    grid.material.transparent = true;
    grid.material.opacity = isDark ? 0.55 : 0.4;
    scene.add(grid);

    /* ── Fog ── */
    scene.fog = new THREE.FogExp2(new THREE.Color(opts.background), 0.025);

    /* ── Orbit controls ── */
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.screenSpacePanning = false;
    controls.minDistance = 0.05;
    controls.maxDistance = 500;
    controls.autoRotate = opts.autorotate;
    controls.autoRotateSpeed = 1.4;

    /* ── Resize observer ── */
    function resize() {
      const w = wrap.clientWidth;
      const h = opts.height;
      canvas.style.width  = "100%";
      canvas.style.height = h + "px";
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const wrap = document.getElementById(id);
    new ResizeObserver(resize).observe(wrap);
    resize();

    /* ── Load model ── */
    const ext = opts.src.split("?")[0].split(".").pop().toLowerCase();
    badge$.textContent = ext.toUpperCase();

    const onProgress = (e) => {
      if (e.lengthComputable) prog$.style.width = (e.loaded / e.total * 100) + "%";
    };

    let modelRoot;

    if (ext === "glb" || ext === "gltf") {
      const draco = new DRACOLoader();
      draco.setDecoderPath(
        `https://cdn.jsdelivr.net/npm/three@${VERSION}/examples/jsm/libs/draco/`
      );
      const loader = new GLTFLoader();
      loader.setDRACOLoader(draco);

      const gltf = await new Promise((res, rej) => loader.load(opts.src, res, onProgress, rej));
      gltf.scene.traverse((n) => {
        if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; }
      });
      modelRoot = gltf.scene;

    } else if (ext === "stl") {
      const geo = await new Promise((res, rej) =>
        new STLLoader().load(opts.src, res, onProgress, rej)
      );
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        color: isDark ? 0x8899cc : 0x4455aa,
        metalness: 0.25,
        roughness: 0.6,
      });
      modelRoot = new THREE.Mesh(geo, mat);
      modelRoot.castShadow = true;
      modelRoot.receiveShadow = true;

    } else {
      throw new Error("Unsupported format: " + ext);
    }

    scene.add(modelRoot);

    /* ── Fit camera to model ── */
    const box    = new THREE.Box3().setFromObject(modelRoot);
    const centre = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    // Centre at origin, sit on grid
    modelRoot.position.sub(centre);
    modelRoot.position.y += size.y / 2;

    const dist = maxDim * 2.0;
    camera.position.set(dist * 0.6, dist * 0.45, dist);
    camera.near = maxDim * 0.001;
    camera.far  = maxDim * 200;
    camera.updateProjectionMatrix();

    const target = new THREE.Vector3(0, size.y / 2, 0);
    controls.target.copy(target);
    controls.update();

    // Scale grid
    grid.scale.setScalar(Math.max(maxDim, 1));

    const camPos0 = camera.position.clone();
    const target0 = target.clone();

    /* ── Hide loader ── */
    prog$.style.width = "100%";
    setTimeout(() => loader$.classList.add("hidden"), 350);

    /* ── Buttons ── */
    const $ = (s) => document.getElementById(s);
    const btnRotate = $(`${id}-btn-rotate`);
    const btnReset  = $(`${id}-btn-reset`);
    const btnGrid   = $(`${id}-btn-grid`);
    const btnFs     = $(`${id}-btn-fs`);

    btnRotate.addEventListener("click", () => {
      controls.autoRotate = !controls.autoRotate;
      btnRotate.classList.toggle("active", controls.autoRotate);
    });

    btnReset.addEventListener("click", () => {
      camera.position.copy(camPos0);
      controls.target.copy(target0);
      controls.update();
    });

    btnGrid.addEventListener("click", () => {
      grid.visible = !grid.visible;
      btnGrid.classList.toggle("active", grid.visible);
    });

    btnFs.addEventListener("click", () => {
      if (!document.fullscreenElement) wrap.requestFullscreen?.();
      else document.exitFullscreen?.();
    });

    document.addEventListener("fullscreenchange", resize);

    /* ── Render loop ── */
    let raf;
    function animate() {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else animate();
    });
  }

  /* ── Utility ── */
  function _isDark(hex) {
    hex = (hex || "#000").replace("#", "");
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }

})();
