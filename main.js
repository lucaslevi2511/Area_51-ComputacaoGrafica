// main.js
import * as Utils from "./webgl-utils.js";
import { parseOBJ } from "./obj-parser.js";
import { createRenderable } from "./renderer.js";
import * as Math3D from "./math.js";
import { createExhibitCorridor } from "./geometry-generator.js";
import {createCamera,updateCameraMovement,updateCameraLook,getViewMatrix} from "./camera.js";

let gl, prog, lightProg;
let sceneObjects = [];
let angle = 0;

// Câmera
let camera;
let lastTime = 0;

// Input
const input = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

const arquivos = ["obj/sun.obj", "obj/pucci.obj"];
const texSrc = ["img/textura_sol.jpg", "img/pucci.png"];

async function init() {
  const modelTexts = await Promise.all(
    arquivos.map(url => fetch(url).then(r => r.text()))
  );
  const loadedImages = await Promise.all(
    texSrc.map(url => Utils.loadImage(url))
  );

  const metalImg = await Utils.loadImage("img/metal.jpg");

  initGL();
  setupInput();

  camera = createCamera();

  const modelParsers = modelTexts.map(text => parseOBJ(text));
  const textureLibrary = loadedImages.map(img =>
    Utils.createWebGLTexture(gl, img)
  );
  const metalTexture = Utils.createWebGLTexture(gl, metalImg);

  // Corredor
  const corridor = createExhibitCorridor(gl);
  corridor.isLightSource = false;
  corridor.transform.y = -15;
  corridor.texture = metalTexture;
  sceneObjects.push(corridor);

  // Modelos OBJ
  modelParsers.forEach((dados, mIndex) => {
    dados.geometries.forEach(geom => {
      if (!geom.data.position) return;

      const obj = createRenderable(gl, geom);

      const center = Utils.getBoundingBoxCenter(geom.data.position);
      obj.centerCorrection = {
        x: -center.x,
        y: -center.y,
        z: -center.z
      };

      if (mIndex === 0) {
        obj.isLightSource = true;
        obj.transform.scale = 0.01;
      } else {
        obj.transform.scale = 5;
        obj.transform.x = 23;
        obj.transform.z = 0;
        obj.transform.ry = -100;
      }

      obj.texture = textureLibrary[mIndex];
      sceneObjects.push(obj);
    });
  });

  requestAnimationFrame(draw);
}

function initGL() {
  const canvas = document.getElementById("glcanvas1");
  gl = Utils.getGL(canvas);

  const vtxSrc = document.getElementById("vertex-shader").text;
  const fragSrc = document.getElementById("frag-shader").text;

  const lightFragSrc = `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D tex;
    void main() {
      gl_FragColor = texture2D(tex, v_texCoord);
    }
  `;

  const vShader = Utils.createShader(gl, gl.VERTEX_SHADER, vtxSrc);
  const fShader = Utils.createShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const lfShader = Utils.createShader(gl, gl.FRAGMENT_SHADER, lightFragSrc);

  prog = Utils.createProgram(gl, vShader, fShader);
  lightProg = Utils.createProgram(gl, vShader, lfShader);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0, 0, 0, 1);
  gl.enable(gl.DEPTH_TEST);
}

function setupInput() {
  const canvas = gl.canvas;

  canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;

  canvas.onclick = () => canvas.requestPointerLock();

  document.addEventListener("mousemove", e => {
    if (document.pointerLockElement === canvas) {
      updateCameraLook(camera, e.movementX, e.movementY);
    }
  });

  window.addEventListener("keydown", e => {
    if (e.key === "w") input.forward = true;
    if (e.key === "s") input.backward = true;
    if (e.key === "a") input.left = true;
    if (e.key === "d") input.right = true;
  });

  window.addEventListener("keyup", e => {
    if (e.key === "w") input.forward = false;
    if (e.key === "s") input.backward = false;
    if (e.key === "a") input.left = false;
    if (e.key === "d") input.right = false;
  });
}

function draw(time = 0) {
  const deltaTime = (time - lastTime) * 0.001;
  lastTime = time;

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  angle++;

  updateCameraMovement(camera, input, deltaTime);

  const aspect = gl.canvas.width / gl.canvas.height;
  const projection = Math3D.createPerspective(60, aspect, 0.5, 2000);
  const view = getViewMatrix(camera);

  const radius = 10000;
  const sunAngle = Math.sqrt(angle);
  const lx = Math.cos(sunAngle) * radius;
  const ly = Math.sin(sunAngle) * radius;
  const lz = 0;

  sceneObjects.forEach(obj => {
    const program = obj.isLightSource ? lightProg : prog;
    gl.useProgram(program);

    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, "projection"),
      false,
      projection
    );
    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, "view"),
      false,
      view
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, obj.buffer);
    const posLoc = gl.getAttribLocation(program, "position");
    if (posLoc !== -1) {
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
    }
    // No main.js, dentro do loop sceneObjects.forEach
    const normLoc = gl.getAttribLocation(program, "normal");

    // Mude de obj.bufferNormal para obj.normalBuffer
    if (normLoc !== -1 && obj.normalBuffer) { 
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.normalBuffer);
        gl.enableVertexAttribArray(normLoc);
        gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);
    }
    
    if (!obj.isLightSource) {
      gl.uniform3f(
        gl.getUniformLocation(program, "u_lightPosStatic"),
        20, 50, 40
      );
      gl.uniform3f(
        gl.getUniformLocation(program, "u_lightPosDynamic"),
        lx, ly, lz
      );
      gl.uniform3f(
        gl.getUniformLocation(program, "u_viewPosition"),
        camera.position[0],
        camera.position[1],
        camera.position[2]
      );
    } else {
      obj.transform.x = lx;
      obj.transform.y = ly;
      obj.transform.z = lz;
    }

    if (obj.bufferTexCoord) {
      const texLoc = gl.getAttribLocation(program, "texCoord");
      if (texLoc !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.bufferTexCoord);
        gl.enableVertexAttribArray(texLoc);
        gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, obj.texture);
        gl.uniform1i(gl.getUniformLocation(program, "tex"), 0);
      }
    }

    const matS = Math3D.scaleMatrix(
      obj.transform.scale,
      obj.transform.scale,
      obj.transform.scale
    );
    const matR = Math3D.rotateY(obj.transform.ry || 0);
    const matT = Math3D.translationMatrix(
      obj.transform.x,
      obj.transform.y,
      obj.transform.z
    );

    const model = Math3D.multiply(Math3D.multiply(matR, matS), matT);

    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, "transf"),
      false,
      model
    );

    gl.drawArrays(gl.TRIANGLES, 0, obj.numVertices);
  });

  requestAnimationFrame(draw);
}

window.onload = init;
