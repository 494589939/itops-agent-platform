import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Rack3D } from './types';
import { floorTex, labelTex, deviceNameSprite } from './SceneTextures';

export type ViewMode = 'overview' | 'zoneA' | 'zoneB';

interface SceneProps {
  racks: Rack3D[];
  onRackClick: (rackId: string) => void;
  onSlotClick?: (rackId: string, slotId: string) => void;
  selectedRackId?: string | null;
  selectedSlotId?: string | null;
  hoveredRackId?: string | null;
  onHoverChange?: (rackId: string | null) => void;
  heatmapData?: Record<string, number>;
  viewMode: ViewMode;
}

/** Three.js 对象的 userData 扩展属性 */
interface RackUserData {
  rackId?: string;
  slotId?: string;
  isRackDoor?: boolean;
  isStatusLed?: boolean;
  isGlow?: boolean;
  targetRotation?: number;
}

type ThreeObject = THREE.Object3D & { isMesh?: boolean; material?: THREE.Material & { opacity?: number }; userData: RackUserData };

const geo = {
  led: new THREE.SphereGeometry(0.02, 4, 4),
  glow: new THREE.SphereGeometry(0.035, 4, 4),
  foot: new THREE.CylinderGeometry(0.06, 0.08, 0.1, 8),
};

// 提亮机柜颜色
// 提亮机柜材质：深色+透明玻璃在暗背景下容易"隐形"，聚焦时只看到地板
const mats = {
  bodyN: new THREE.MeshStandardMaterial({ color: 0x8496a8, metalness: 0.55, roughness: 0.35 }),
  bodyW: new THREE.MeshStandardMaterial({ color: 0x8f6f4a, metalness: 0.55, roughness: 0.35 }),
  top: new THREE.MeshStandardMaterial({ color: 0x94a5b5, metalness: 0.65, roughness: 0.25 }),
  frame: new THREE.MeshStandardMaterial({ color: 0xa5b5c5, metalness: 0.8, roughness: 0.15 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xaaddff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.16 }),
  serverN: new THREE.MeshStandardMaterial({ color: 0x6e7f91, metalness: 0.45, roughness: 0.35 }),
  serverW: new THREE.MeshStandardMaterial({ color: 0x8a6a45, metalness: 0.45, roughness: 0.35 }),
  ledG: new THREE.MeshBasicMaterial({ color: 0x00ff88 }),
  ledC: new THREE.MeshBasicMaterial({ color: 0x00d4ff }),
  ledR: new THREE.MeshBasicMaterial({ color: 0xff4444 }),
  glowG: new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }),
  glowR: new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }),
  sideC: new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }),
  sideO: new THREE.MeshBasicMaterial({ color: 0xff6644, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }),
};

const RW = 2.2, RD = 1.2, RH = 5.5;

function createRack(rack: Rack3D, doorOpen = false): THREE.Group {
  const g = new THREE.Group();
  g.userData = { rackId: rack.id };
  const warn = rack.alertCount > 0;
  const bm = warn ? mats.bodyW : mats.bodyN;
  const sm = warn ? mats.serverW : mats.serverN;
  const sgm = warn ? mats.sideO : mats.sideC;
  // U 位高度按机柜实际 U 数计算（支持 42U/48U 等）
  const UH = RH / (rack.totalU || 42);

  const back = new THREE.Mesh(new THREE.BoxGeometry(RW, RH, 0.06), bm);
  back.position.set(0, RH / 2, -RD / 2);
  back.castShadow = back.receiveShadow = true; g.add(back);

  const left = new THREE.Mesh(new THREE.BoxGeometry(0.06, RH, RD), bm);
  left.position.set(-RW / 2, RH / 2, 0);
  left.castShadow = left.receiveShadow = true; g.add(left);

  const right = new THREE.Mesh(new THREE.BoxGeometry(0.06, RH, RD), bm);
  right.position.set(RW / 2, RH / 2, 0);
  right.castShadow = right.receiveShadow = true; g.add(right);

  const top = new THREE.Mesh(new THREE.BoxGeometry(RW + 0.1, 0.06, RD + 0.1), mats.top);
  top.position.y = RH + 0.03; top.castShadow = true; g.add(top);

  const bottom = new THREE.Mesh(new THREE.BoxGeometry(RW + 0.1, 0.04, RD + 0.1), bm);
  bottom.position.y = 0.02; bottom.castShadow = true; g.add(bottom);

  [[-RW / 2 + 0.2, -RD / 2 + 0.2], [RW / 2 - 0.2, -RD / 2 + 0.2], [-RW / 2 + 0.2, RD / 2 - 0.2], [RW / 2 - 0.2, RD / 2 - 0.2]].forEach(([fx, fz]) => {
    const f = new THREE.Mesh(geo.foot, mats.top);
    f.position.set(fx, 0.05, fz); g.add(f);
  });

  // 单开门：铰链在机柜右前侧，整扇门绕此铰链向左侧外开
  const ft = 0.04;
  const fm = mats.frame;
  const doorWidth = RW - 0.1;

  const doorPivot = new THREE.Group();
  // 铰链放在右前侧（现实服务器机柜单开门多为右铰链）
  doorPivot.position.set(RW / 2 - ft / 2, 0, RD / 2);
  doorPivot.userData = { isRackDoor: true, side: 'right', targetRotation: doorOpen ? Math.PI * (110 / 180) : 0 };
  // 重建机柜时若处于开门状态（doorOpen），直接恢复开门角度而不是从关闭补间，
  // 避免 WS 数据刷新重建后门"闪关再开"；门只在退出预览（取消选中）时补间关闭
  doorPivot.rotation.y = doorOpen ? Math.PI * (110 / 180) : 0;

  // 玻璃面中心相对 pivot 向左偏移半门宽
  const glass = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, RH - 0.1, 0.02), mats.glass);
  glass.position.set(-doorWidth / 2, RH / 2, 0); doorPivot.add(glass);

  // 边框：顶/底/左（铰链侧不需外框）
  const tf = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, ft, ft), fm);
  tf.position.set(-doorWidth / 2, RH + ft / 2, 0); doorPivot.add(tf);
  const bf = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, ft, ft), fm);
  bf.position.set(-doorWidth / 2, ft / 2, 0); doorPivot.add(bf);
  const of = new THREE.Mesh(new THREE.BoxGeometry(ft, RH - 0.1, ft), fm);
  // 外侧边框（门的左边缘，远离铰链一侧）
  of.position.set(-doorWidth, RH / 2, 0); doorPivot.add(of);

  // 把手在门的内侧左侧（远离铰链，便于开门）
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.2, 0.06), fm);
  handle.position.set(-doorWidth + 0.2, RH / 2, 0.04); doorPivot.add(handle);

  g.add(doorPivot);

  const usedU = Math.min(rack.usedU, rack.totalU);
  const slots = rack.slots || [];

  if (slots.length > 0) {
    // 按实际 U 位位置渲染设备
    for (const slot of slots) {
      const uHeight = slot.endU - slot.startU + 1;
      // U 位坐标：startU=1 → y=UH*0.5 (底部), startU=42 → y=UH*41.5 (顶部)
      // 设备中心 y = UH * (startU - 1 + uHeight/2) = UH * (startU + endU) / 2 - 0.5
      const centerY = UH * (slot.startU + slot.endU) / 2 - UH * 0.5;
      const serverHeight = UH * uHeight * 0.85;
      // 每个设备用独立材质（克隆），便于点击后单独高亮；userData 记录 slotId + rackId 供射线拾取
      const server = new THREE.Mesh(new THREE.BoxGeometry(RW - 0.3, serverHeight, RD - 0.2), sm.clone());
      server.userData = { rackId: rack.id, slotId: slot.id || String(slot.startU) };
      server.position.set(0, centerY, 0); server.castShadow = true; g.add(server);
      const ledM = warn ? mats.ledR : (slot.startU % 3 === 0 ? mats.ledG : mats.ledC);
      const led = new THREE.Mesh(geo.led, ledM);
      led.position.set(-RW / 2 + 0.2, centerY, RD / 2 - 0.02); g.add(led);
      const gl = new THREE.Mesh(geo.glow, warn ? mats.glowR : mats.glowG);
      gl.position.copy(led.position); g.add(gl);
      // 设备名称显示在 3D 模型上（Sprite 始终面向相机，高度按 U 数缩放避免 1U 设备名称重叠）
      if (slot.deviceName) {
        const ns = deviceNameSprite(slot.deviceName, warn, uHeight);
        ns.position.set(0, centerY, RD / 2 + 0.45);
        g.add(ns);
      }
    }
  } else {
    // 兼容：无 slot 数据时，按 usedU 顺序填充
    for (let u = 0; u < usedU; u++) {
      const y = UH * (u + 0.5);
      const server = new THREE.Mesh(new THREE.BoxGeometry(RW - 0.3, UH * 0.85, RD - 0.2), sm.clone());
      server.userData = { rackId: rack.id, slotId: String(u + 1) };
      server.position.set(0, y, 0); server.castShadow = true; g.add(server);
      const ledM = warn ? mats.ledR : (u % 3 === 0 ? mats.ledG : mats.ledC);
      const led = new THREE.Mesh(geo.led, ledM);
      led.position.set(-RW / 2 + 0.2, y, RD / 2 - 0.02); g.add(led);
      const gl = new THREE.Mesh(geo.glow, warn ? mats.glowR : mats.glowG);
      gl.position.copy(led.position); g.add(gl);
    }
  }

  const lt = labelTex(rack.name, warn);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.4),
    new THREE.MeshBasicMaterial({ map: lt, transparent: true, side: THREE.DoubleSide, depthWrite: false })
  );
  label.position.set(0, RH + 0.5, RD / 2 + 0.01); g.add(label);

  const sl = new THREE.Mesh(geo.led, warn ? mats.ledR : mats.ledG);
  sl.position.set(0, RH + 0.03, RD / 2 + 0.01); sl.scale.setScalar(3);
  sl.userData = { isStatusLed: true }; g.add(sl);
  const sg = new THREE.Mesh(geo.glow, warn ? mats.glowR : mats.glowG);
  sg.position.copy(sl.position); sg.scale.setScalar(3);
  sg.userData = { isGlow: true }; g.add(sg);

  const lg = new THREE.Mesh(new THREE.BoxGeometry(0.01, RH * 0.9, 0.01), sgm);
  lg.position.set(-RW / 2 - 0.01, RH / 2, RD / 2 - 0.05); g.add(lg);
  const rg = new THREE.Mesh(new THREE.BoxGeometry(0.01, RH * 0.9, 0.01), sgm);
  rg.position.set(RW / 2 + 0.01, RH / 2, RD / 2 - 0.05); g.add(rg);

  return g;
}

function createEnv(scene: THREE.Scene) {
  const ft = floorTex();
  ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
  ft.repeat.set(40, 40);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ map: ft, color: 0x6a7a8a, metalness: 0.05, roughness: 0.8 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(80, 40, 0x4488aa, 0x335577);
  grid.position.y = 0.02;
  grid.material.opacity = 0.5;
  grid.material.transparent = true;
  scene.add(grid);
}

// 视图相机目标
// 机柜布局：col*4.5 沿 X 方向（-16..+15.5），row*10 沿 Z 方向（A=row0 → Z=-5，B=row1 → Z=+5）
// 机柜底部 FLOOR_OFFSET=0：机柜直接站在地板（y=0）上，不悬浮
// 设计原则：相机 Y 取机柜中点附近（不站太高），target Y 取机柜中点，Z 拉远保证视野宽度
const FLOOR_OFFSET = 0;
const TGT_Y = FLOOR_OFFSET + RH / 2; // = 2.75，机柜中点 Y（RH 在文件顶部已声明）
const VIEW_TARGETS: Record<ViewMode, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
  // 总览：俯角 ~20°，相机 Y 抬高确保地板占视野底部 1/3、机柜在中上部
  overview: { pos: new THREE.Vector3(0, TGT_Y + 18, 48), target: new THREE.Vector3(0, TGT_Y, 0) },
  // zoneA：从 A 区南侧远处斜俯视 A 区（俯角 ~16°），地板在下、机柜立面朝相机
  zoneA:    { pos: new THREE.Vector3(0, TGT_Y + 15, -50), target: new THREE.Vector3(0, TGT_Y, -5) },
  // zoneB：从 B 区北侧远处斜俯视 B 区
  zoneB:    { pos: new THREE.Vector3(0, TGT_Y + 15, 50),  target: new THREE.Vector3(0, TGT_Y, 5) },
};

// 选中机柜聚焦：距离按机柜包围盒高度自适应（见聚焦 effect），保证完整看到机柜

/**
 * 平滑移动相机到指定位置与 target（easeInOutQuad，800ms）。
 * 期间通过 isTweeningView 锁让 raf loop 跳过 controls.update()，
 * 避免 OrbitControls 用旧 spherical 反算 camera.position 覆盖 tween；结束后同步。
 */
function tweenCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  endPos: THREE.Vector3,
  endTarget: THREE.Vector3,
  isTweeningView: { current: boolean },
  duration = 800,
): void {
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const startTime = Date.now();
  // tween 期间禁用 OrbitControls 交互：避免用户滚轮/拖拽在动画中干扰相机位置
  controls.enabled = false;
  const step = () => {
    const t = Math.min((Date.now() - startTime) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
    camera.position.lerpVectors(startPos, endPos, ease);
    controls.target.lerpVectors(startTarget, endTarget, ease);
    camera.lookAt(controls.target);
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      // 动画结束：让 OrbitControls 用新的 camera/target 重新构建内部 spherical 状态，恢复交互
      controls.update();
      isTweeningView.current = false;
      controls.enabled = true;
    }
  };
  step();
}

export default function Scene({ racks, onRackClick, onSlotClick, selectedRackId, selectedSlotId, hoveredRackId, onHoverChange, heatmapData, viewMode }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rackMap = useRef<Map<string, THREE.Group>>(new Map());
  const ray = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const anim = useRef<{ doors: THREE.Group[]; leds: THREE.Mesh[]; glows: THREE.Mesh[] }>({ doors: [], leds: [], glows: [] });
  const viewModeRef = useRef(viewMode);
  // 视图切换 tween 锁：期间 raf loop 跳过 controls.update()，避免 OrbitControls 用旧 spherical 覆盖相机位置
  const isTweeningView = useRef(false);

  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

  // 初始化
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const w = cv.clientWidth, h = cv.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e2e3e);
    scene.fog = new THREE.Fog(0x1e2e3e, 40, 120);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
    camera.position.copy(VIEW_TARGETS.overview.pos);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: false });
    renderer.setClearColor(0x1e2e3e);
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, cv);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = 4; // 允许滚轮放大到看清机柜 U 位设备
    controls.maxDistance = 70;
    controls.target.copy(VIEW_TARGETS.overview.target);
    controlsRef.current = controls;

    // 灯光
    scene.add(new THREE.AmbientLight(0xbbccdd, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    scene.add(new THREE.DirectionalLight(0x99aacc, 0.5)).position.set(-20, 25, -10);
    scene.add(new THREE.DirectionalLight(0xaabbdd, 0.4)).position.set(20, 20, 10);
    scene.add(new THREE.PointLight(0x00d4ff, 2.5, 50)).position.set(-10, 8, 0);
    scene.add(new THREE.PointLight(0x00d4ff, 2.5, 50)).position.set(10, 8, 0);
    scene.add(new THREE.PointLight(0x4488ff, 1.5, 40)).position.set(0, 10, 0);
    scene.add(new THREE.HemisphereLight(0x99aacc, 0x445566, 0.6));

    createEnv(scene);

    // 交互
    let dragging = false, ds = { x: 0, y: 0 };

    // 沿父级链解析命中对象：优先设备（slotId），其次机柜（rackId）
    const resolveHit = (obj: THREE.Object3D): RackUserData => {
      let c: THREE.Object3D | null = obj;
      while (c) {
        const ud = (c as ThreeObject).userData;
        if (ud?.slotId || ud?.rackId) return ud;
        c = c.parent;
      }
      return {};
    };

    const onDown = (e: PointerEvent) => {
      dragging = false; ds = { x: e.clientX, y: e.clientY };
      cv.addEventListener('pointermove', onMove);
      cv.addEventListener('pointerup', onUp);
    };
    const onMove = (e: PointerEvent) => {
      if (Math.abs(e.clientX - ds.x) > 3 || Math.abs(e.clientY - ds.y) > 3) dragging = true;
      const r = cv.getBoundingClientRect();
      mouse.current.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.current.setFromCamera(mouse.current, camera);
      const hits = ray.current.intersectObjects(
        Array.from(rackMap.current.values()).flatMap(g => { const a: THREE.Object3D[] = []; g.traverse(c => { if ((c as ThreeObject).isMesh) a.push(c); }); return a; }),
        false
      );
      let hid: string | null = null;
      if (hits.length > 0) hid = resolveHit(hits[0].object).rackId ?? null;
      onHoverChange?.(hid);
    };
    const onUp = (e: PointerEvent) => {
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      if (dragging) return;
      const r = cv.getBoundingClientRect();
      mouse.current.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.current.setFromCamera(mouse.current, camera);
      const hits = ray.current.intersectObjects(
        Array.from(rackMap.current.values()).flatMap(g => { const a: THREE.Object3D[] = []; g.traverse(c => { if ((c as ThreeObject).isMesh) a.push(c); }); return a; }),
        false
      );
      if (hits.length > 0) {
        const ud = resolveHit(hits[0].object);
        if (ud.slotId && onSlotClick) onSlotClick(ud.rackId || '', ud.slotId);
        else if (ud.rackId) onRackClick(ud.rackId);
      } else { onRackClick(''); } // 点击空白处：取消选中并回到当前视图
    };
    cv.addEventListener('pointerdown', onDown);

    const onResize = () => {
      const r = cv.getBoundingClientRect();
      camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
      renderer.setSize(r.width, r.height, false);
    };
    window.addEventListener('resize', onResize);

    let aid: number;
    const loop = () => {
      aid = requestAnimationFrame(loop);
      // 视图 tween 期间不调用 controls.update()，否则 OrbitControls 会用旧 spherical 反算 camera.position 覆盖 tween
      if (!isTweeningView.current) controls.update();
      const t = Date.now() * 0.001;
      anim.current.doors.forEach(d => {
        const tg = (d.userData as RackUserData).targetRotation || 0;
        const df = tg - d.rotation.y;
        if (Math.abs(df) > 0.001) d.rotation.y += df * 0.1;
        else d.rotation.y = tg;
      });
      anim.current.leds.forEach(l => { ((l as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.6 * Math.sin(t * 3); });
      anim.current.glows.forEach(g => {
        g.scale.setScalar(0.7 + 0.5 * Math.sin(t * 3));
        ((g as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.3 * Math.sin(t * 3);
      });
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      window.removeEventListener('resize', onResize);
      cv.removeEventListener('pointerdown', onDown);
      cancelAnimationFrame(aid);
      renderer.dispose();
      scene.clear();
      controls.dispose();
    };
  }, []);

  // 视图切换
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const vt = VIEW_TARGETS[viewMode];
    // 平滑动画：用 tween 锁让 raf loop 跳过 controls.update()，否则 OrbitControls 会用旧 spherical 反算 camera.position
    isTweeningView.current = true;
    tweenCamera(camera, controls, vt.pos, vt.target, isTweeningView);
  }, [viewMode]);

  // 选中机柜聚焦：把 OrbitControls.target 移到机柜中点、相机拉近，
  // 此后滚轮缩放/旋转都围绕该机柜（能看到机柜及 U 位设备的 3D 位置）；取消选中回到当前视图
  const isFirstFocus = useRef(true);
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    // 首次挂载时相机已处于当前视图，无需动画（避免无谓的 800ms tween 锁）
    if (isFirstFocus.current) {
      isFirstFocus.current = false;
      return;
    }
    const rackId = selectedRackId || null;
    let endPos: THREE.Vector3;
    let endTarget: THREE.Vector3;
    if (rackId) {
      const g = rackMap.current.get(rackId);
      if (!g) return;
      // 焦点 = 机柜真实几何中心（世界坐标，用包围盒计算，不依赖任何位置假设）
      const box = new THREE.Box3().setFromObject(g);
      const center = box.getCenter(new THREE.Vector3());
      // 距离自适应机柜高度：保证能看到整个机柜（约 65% 画面占比），不过近也不过远
      const size = box.getSize(new THREE.Vector3());
      const focusDist = Math.max(size.y * 1.6, 7);
      // 相机固定在机柜正面（+z 侧）斜上方 30° 俯角（polar=60°），方位角固定 0：
      // 每次点击都从机柜正面稳定视角观察，不会绕到侧面/背面或对焦到地板
      const polar = THREE.MathUtils.degToRad(60);
      const sp = Math.sin(polar), cp = Math.cos(polar);
      endTarget = center;
      endPos = new THREE.Vector3(
        center.x,
        center.y + focusDist * cp,
        center.z + focusDist * sp,
      );
    } else {
      const vt = VIEW_TARGETS[viewModeRef.current];
      endPos = vt.pos;
      endTarget = vt.target;
    }
    isTweeningView.current = true;
    tweenCamera(camera, controls, endPos, endTarget, isTweeningView);
  }, [selectedRackId]);

  // 更新机柜
  useEffect(() => {
    const scene = sceneRef.current; if (!scene) return;
    rackMap.current.forEach(g => scene.remove(g));
    rackMap.current.clear();
    anim.current = { doors: [], leds: [], glows: [] };

    const spacing = 4.5;
    // 机柜直接站在地板（y=0）上，不悬浮
    const FLOOR_OFFSET = 0;
    racks.forEach((rack, i) => {
      // 重建时保留选中机柜的开门状态（doorOpen），避免 WS 数据刷新后门自动关闭
      const g = createRack(rack, rack.id === selectedRackId);
      const col = i % 8, row = Math.floor(i / 8);
      g.position.set(-16 + col * spacing, FLOOR_OFFSET, -5 + row * 10);
      scene.add(g);
      rackMap.current.set(rack.id, g);
      g.traverse(o => {
        if ((o as ThreeObject).userData?.isRackDoor) anim.current.doors.push(o as THREE.Group);
        if ((o as ThreeObject).userData?.isStatusLed) anim.current.leds.push(o as THREE.Mesh);
        if ((o as ThreeObject).userData?.isGlow) anim.current.glows.push(o as THREE.Mesh);
      });
    });
  }, [racks, heatmapData]);

  // 高亮（依赖含 racks/heatmapData：机柜重建后重新应用选中/悬停状态，门保持打开）
  useEffect(() => {
    rackMap.current.forEach((g, id) => {
      const sel = id === selectedRackId, hov = id === hoveredRackId;
      g.scale.setScalar(sel || hov ? 1.03 : 1);
      g.traverse(o => {
        if ((o as ThreeObject).userData?.isRackDoor) {
          // 单开门：铰链在右，门向左侧外开约 110°（绕 Y 逆时针 = 正角度）
          (o as ThreeObject).userData.targetRotation = sel ? Math.PI * (110 / 180) : 0;
        }
      });
    });
  }, [selectedRackId, hoveredRackId, racks, heatmapData]);

  // 设备高亮：选中某 U 位设备时发光（设备材质已在 createRack 中克隆为独立材质）
  useEffect(() => {
    rackMap.current.forEach((g) => {
      g.traverse(o => {
        const ud = (o as ThreeObject).userData;
        if (!ud?.slotId) return;
        const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!mat || !('emissive' in mat)) return;
        const sel = ud.slotId === selectedSlotId;
        mat.emissive = sel ? new THREE.Color(0x00d4ff) : new THREE.Color(0x000000);
        mat.emissiveIntensity = sel ? 0.45 : 0;
      });
    });
  }, [selectedSlotId]);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />
    </>
  );
}
