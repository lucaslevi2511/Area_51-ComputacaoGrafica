import { normalize, cross } from "./math.js";
import { lookat } from "./math.js";

export function createCamera() {
  return {
    position: [0, 5, 0], // altura dos olhos
    yaw: 0,               // esquerda / direita
    pitch: 0,             // cima / baixo
    speed: 15.0,
    sensitivity: 0.003
  };
}

function getForward(camera) {
  return normalize([
    Math.sin(camera.yaw) * Math.cos(camera.pitch),
    Math.sin(camera.pitch),
   -Math.cos(camera.yaw) * Math.cos(camera.pitch)
  ]);
}

function getRight(camera) {
  return normalize(
    cross(getForward(camera), [0, 1, 0])
  );
}

export function updateCameraMovement(camera, input, deltaTime) {
  const velocity = camera.speed * deltaTime;

  const moveForward = [Math.sin(camera.yaw), 0, -Math.cos(camera.yaw)];
  const moveRight = [Math.cos(camera.yaw), 0, Math.sin(camera.yaw)];

  // 1. Criamos uma cópia da posição atual para calcular o próximo passo
  let nextPos = [...camera.position];

  if (input.forward) {
    nextPos[0] += moveForward[0] * velocity;
    nextPos[2] += moveForward[2] * velocity;
  }
  if (input.backward) {
    nextPos[0] -= moveForward[0] * velocity;
    nextPos[2] -= moveForward[2] * velocity;
  }
  if (input.left) {
    nextPos[0] -= moveRight[0] * velocity;
    nextPos[2] -= moveRight[2] * velocity;
  }
  if (input.right) {
    nextPos[0] += moveRight[0] * velocity;
    nextPos[2] += moveRight[2] * velocity;
  }

  // 2. Definimos as margens (Box de colisão)
  // Deixamos uma pequena margem (ex: 1.0) para o jogador não "colar" na parede
  const margin = 1.5;
  const wallLimitX = 20.0 - margin;
  const wallLimitZ = 100.0 - margin;

  // 3. Verificação de Colisão (Restrição de movimento)
  
  // Colisão com as paredes laterais (Eixo X)
  if (nextPos[0] > wallLimitX) nextPos[0] = wallLimitX;
  if (nextPos[0] < -wallLimitX) nextPos[0] = -wallLimitX;

  // Colisão com o fundo e a frente (Eixo Z)
  if (nextPos[2] > wallLimitZ) nextPos[2] = wallLimitZ;
  if (nextPos[2] < -wallLimitZ) nextPos[2] = -wallLimitZ;

  // 4. Aplica a posição final (já validada)
  camera.position[0] = nextPos[0];
  camera.position[2] = nextPos[2];
}

export function updateCameraLook(camera, dx, dy) {
  camera.yaw   += dx * camera.sensitivity;
  camera.pitch -= dy * camera.sensitivity;

  // evita virar a cabeça 360° pra cima
  const limit = Math.PI / 2 - 0.01;
  camera.pitch = Math.max(-limit, Math.min(limit, camera.pitch));
}

export function getViewMatrix(camera) {
  const forward = getForward(camera);
  const target = [
    camera.position[0] + forward[0],
    camera.position[1] + forward[1],
    camera.position[2] + forward[2]
  ];

  return lookat(
    camera.position,
    target,
    [0, 1, 0]
  );
}
